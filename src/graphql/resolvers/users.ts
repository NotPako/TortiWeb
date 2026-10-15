import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { Vote } from '@/models/Vote';
import { Comment } from '@/models/Comment';
import { TortillaEvent } from '@/models/TortillaEvent';
import { Membership } from '@/models/Membership';
import { User, normalizeEmail, normalizeUsername, userImageUrl } from '@/models/User';
import { normalizeAllergens, normalizeAllergyNotes } from '@/lib/allergens';
import {
  birthdaysCelebratedOn,
  todayInTimeZone,
  validateBirthday,
  type Birthday,
} from '@/lib/birthday';
import {
  MAX_NICKNAME_CHANGES,
  nicknameChangesLeft,
  planNicknameChange,
  validateNickname,
} from '@/lib/nickname';
import { requireUser, sessionUser, type GqlContext } from './context';
import { groupIdsOf } from './access';
import { decodeBase64Image, deleteObjectQuietly, inferExtension, putObject } from './media';
import { birthdayPayload, idOf } from './payloads';

// Password: mínimo 8 caracteres.
const MIN_PASSWORD_LENGTH = 8;
// Email mínimo razonable.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Vincula a su cuenta los votos y comentarios anteriores al registro, que solo
 * llevan nombre. Se hace al crear la cuenta o al elegir nombre por primera vez
 * (nunca al renombrarse: si no, cambiarse a un nombre histórico heredaría los
 * votos de otra persona).
 */
async function claimDocsByName(
  userId: Types.ObjectId,
  usernameKey: string
): Promise<void> {
  const orphan = { userKey: usernameKey, user: { $exists: false } };
  await Promise.all([
    Vote.updateMany(orphan, { $set: { user: userId } }).exec(),
    Comment.updateMany(orphan, { $set: { user: userId } }).exec(),
    TortillaEvent.updateMany(
      { attendees: { $elemMatch: orphan } },
      { $set: { 'attendees.$[a].user': userId } },
      { arrayFilters: [{ 'a.userKey': usernameKey, 'a.user': { $exists: false } }] }
    ).exec(),
  ]);
}

/** Lo que devuelven las mutations de cuenta. */
function accountPayload(user: InstanceType<typeof User>) {
  return {
    id: idOf(user),
    username: user.username,
    email: user.email,
    imageUrl: userImageUrl(user),
  };
}

export const userQueries = {
  async me(_: unknown, __: unknown, ctx: GqlContext) {
    if (!ctx.session?.user) return null;
    await connectToDatabase();
    const doc = await User.findById(ctx.session.user.id)
      .select('username email image imageKey allergens allergyNotes nicknameChanges birthday')
      .exec();
    return {
      id: ctx.session.user.id,
      // El nombre sale de la BD: si se cambió hace un momento, el JWT
      // todavía lleva el anterior.
      username: doc?.username ?? ctx.session.user.username,
      email: doc?.email ?? ctx.session.user.email,
      imageUrl: doc ? userImageUrl(doc) : null,
      allergens: doc?.allergens ?? [],
      allergyNotes: doc?.allergyNotes ?? null,
      nicknameChangesLeft: nicknameChangesLeft(doc?.nicknameChanges ?? 0),
      birthday: birthdayPayload(doc?.birthday),
    };
  },

  /**
   * Quién cumple años hoy (hora de Madrid), para el gorro de fiesta. Solo
   * gente con la que compartes algún grupo: no revela nombres de otras peñas.
   */
  async birthdaysToday(_: unknown, __: unknown, ctx: GqlContext) {
    const viewer = sessionUser(ctx.session);
    if (!viewer) return [];
    await connectToDatabase();
    const groupIds = await groupIdsOf(viewer.id);
    if (groupIds.length === 0) return [];
    const memberIds = await Membership.distinct('user', { group: { $in: groupIds } }).exec();
    const docs = await User.find({
      _id: { $in: memberIds },
      $or: birthdaysCelebratedOn(todayInTimeZone()).map((b) => ({
        'birthday.month': b.month,
        'birthday.day': b.day,
      })),
    })
      .select('username')
      .lean()
      .exec();
    return docs.map((d) => d.username);
  },
};

export const userMutations = {
  async register(
    _: unknown,
    args: {
      input: {
        username: string;
        email: string;
        password: string;
        birthday?: Birthday | null;
      };
    }
  ) {
    await connectToDatabase();
    const username = validateNickname(args.input.username);
    const usernameKey = normalizeUsername(username);
    const email = args.input.email.trim();
    if (!EMAIL_RE.test(email)) {
      throw new Error('El email no es válido.');
    }
    if (args.input.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
    }
    const birthday = args.input.birthday ? validateBirthday(args.input.birthday) : undefined;

    const emailKey = normalizeEmail(email);
    const [existingByUsername, existingByEmail] = await Promise.all([
      User.findOne({ usernameKey }).exec(),
      User.findOne({ emailKey }).exec(),
    ]);
    if (existingByUsername) throw new Error('Ese usuario ya existe.');
    if (existingByEmail) throw new Error('Ese email ya está registrado.');

    const passwordHash = await bcrypt.hash(args.input.password, 10);
    const doc = await User.create({
      username,
      usernameKey,
      email,
      emailKey,
      passwordHash,
      birthday,
    });
    // Quien votó antes de tener cuenta recupera su historial al registrarse
    // con el mismo nombre (lo verá al entrar en el grupo de esos votos).
    await claimDocsByName(doc._id as Types.ObjectId, usernameKey);

    return { id: idOf(doc), username: doc.username, email: doc.email };
  },

  async setUsername(
    _: unknown,
    args: { username: string; birthday?: Birthday | null },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    if (!ctx.session?.user) {
      throw new Error('Debes iniciar sesión.');
    }
    const username = validateNickname(args.username);
    const birthday = args.birthday ? validateBirthday(args.birthday) : null;
    const usernameKey = normalizeUsername(username);

    const existing = await User.findOne({ usernameKey }).exec();
    if (existing && idOf(existing) !== ctx.session.user.id) {
      throw new Error('Ese usuario ya existe.');
    }

    const user = await User.findById(ctx.session.user.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');

    user.username = username;
    user.usernameKey = usernameKey;
    if (birthday) user.birthday = birthday;
    await user.save();
    // Normalmente aún no está en ningún grupo, pero si lo está (le invitaron
    // antes de elegir nombre), que se vea el nombre nuevo.
    await Membership.updateMany({ user: user._id }, { $set: { userName: username } }).exec();
    // Es el primer nombre de la cuenta (login con Google), no un cambio: no
    // gasta cupo y sí recupera los votos que dejó antes de registrarse.
    await claimDocsByName(user._id as Types.ObjectId, usernameKey);

    return accountPayload(user);
  },

  async changeNickname(_: unknown, args: { username: string }, ctx: GqlContext) {
    await connectToDatabase();
    const viewer = requireUser(ctx);

    const user = await User.findById(viewer.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');

    const change = planNicknameChange({
      current: user.username,
      requested: args.username,
      used: user.nicknameChanges ?? 0,
    });

    if (change.kind !== 'unchanged') {
      const taken = await User.findOne({ usernameKey: change.usernameKey })
        .select('_id')
        .exec();
      if (taken && !(taken._id as Types.ObjectId).equals(viewer.id)) {
        throw new Error('Ese nombre ya está cogido.');
      }

      user.username = change.username;
      user.usernameKey = change.usernameKey;
      if (change.kind === 'rename') {
        user.nicknameChanges = (user.nicknameChanges ?? 0) + 1;
      }
      await user.save();

      // Votos, comentarios, apuntados y membresías guardan una copia del
      // nombre para mostrarlo sin más consultas: hay que refrescarla. La
      // referencia de verdad (el id) no se toca.
      const rename = {
        $set: { userName: change.username, userKey: change.usernameKey },
      };
      await Promise.all([
        Vote.updateMany({ user: user._id }, rename).exec(),
        Comment.updateMany({ user: user._id }, rename).exec(),
        Membership.updateMany(
          { user: user._id },
          { $set: { userName: change.username } }
        ).exec(),
        TortillaEvent.updateMany(
          { 'attendees.user': user._id },
          {
            $set: {
              'attendees.$[a].userName': change.username,
              'attendees.$[a].userKey': change.usernameKey,
            },
          },
          { arrayFilters: [{ 'a.user': user._id }] }
        ).exec(),
        TortillaEvent.updateMany(
          { 'requests.user': user._id },
          {
            $set: {
              'requests.$[r].userName': change.username,
              'requests.$[r].userKey': change.usernameKey,
            },
          },
          { arrayFilters: [{ 'r.user': user._id }] }
        ).exec(),
      ]);
    }

    return {
      ...accountPayload(user),
      allergens: user.allergens,
      allergyNotes: user.allergyNotes ?? null,
      nicknameChangesLeft: nicknameChangesLeft(user.nicknameChanges ?? 0),
    };
  },

  async setProfileImage(
    _: unknown,
    args: { input: { imageBase64: string; imageContentType: string } },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const viewer = requireUser(ctx);
    if (!args.input.imageContentType.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen.');
    }

    const buffer = decodeBase64Image(args.input.imageBase64);
    if (buffer.length === 0) {
      throw new Error('La imagen está vacía o no es válida.');
    }
    if (buffer.length > 2 * 1024 * 1024) {
      throw new Error('La imagen no puede superar 2 MB.');
    }

    const user = await User.findById(viewer.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');

    const ext = inferExtension(args.input.imageContentType);
    const newKey = `users/${idOf(user)}-${randomUUID()}.${ext}`;
    await putObject(newKey, buffer, args.input.imageContentType);

    const oldKey = user.imageKey;
    user.imageKey = newKey;
    user.imageContentType = args.input.imageContentType;
    await user.save();

    // Limpiamos la imagen anterior (si la había). Errores no son críticos.
    if (oldKey && oldKey !== newKey) {
      await deleteObjectQuietly(oldKey, 'No se pudo eliminar avatar anterior de R2:');
    }
    return accountPayload(user);
  },

  async setAllergies(
    _: unknown,
    args: { input: { allergens: string[]; allergyNotes?: string | null } },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const viewer = requireUser(ctx);
    const allergens = normalizeAllergens(args.input.allergens);
    const allergyNotes = normalizeAllergyNotes(args.input.allergyNotes);

    const user = await User.findById(viewer.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');
    user.allergens = allergens;
    // `undefined` elimina el campo en vez de guardar un null.
    user.allergyNotes = allergyNotes ?? undefined;
    await user.save();

    return {
      ...accountPayload(user),
      allergens: user.allergens,
      allergyNotes: user.allergyNotes ?? null,
    };
  },

  async setBirthday(
    _: unknown,
    args: { birthday?: Birthday | null },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const viewer = requireUser(ctx);
    const birthday = args.birthday ? validateBirthday(args.birthday) : null;

    const user = await User.findById(viewer.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');
    // `undefined` elimina el campo en vez de guardar un null.
    user.birthday = birthday ?? undefined;
    await user.save();

    return { ...accountPayload(user), birthday: birthdayPayload(user.birthday) };
  },
};

export const userFields = {
  // `register`, `setUsername` o `setProfileImage` devuelven un User sin estos
  // campos; el esquema declara `allergens` no nulo, así que damos un vacío.
  allergens(parent: { allergens?: string[] | null }) {
    return parent.allergens ?? [];
  },
  allergyNotes(parent: { allergyNotes?: string | null }) {
    return parent.allergyNotes ?? null;
  },
  // `register` y `setUsername` devuelven un User sin este campo: una cuenta
  // recién creada tiene todos los cambios disponibles.
  nicknameChangesLeft(parent: { nicknameChangesLeft?: number | null }) {
    return parent.nicknameChangesLeft ?? MAX_NICKNAME_CHANGES;
  },
};
