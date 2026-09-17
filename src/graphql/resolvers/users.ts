import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { Membership } from '@/models/Membership';
import { Vote } from '@/models/Vote';
import {
  User,
  normalizeEmail,
  normalizeUsername,
  userImageUrl,
} from '@/models/User';
import { normalizeAllergens, normalizeAllergyNotes } from '@/lib/allergens';
import { requireUser, type GqlContext } from './context';
import { requireGroupAccess } from './access';
import {
  decodeBase64Image,
  deleteObjectQuietly,
  inferExtension,
  putObject,
} from './media';
import { computeUserStats } from './stats';

// Username: 2-20 caracteres, letras/números/_-.
const USERNAME_RE = /^[A-Za-z0-9._-]{2,20}$/;
// Password: mínimo 8 caracteres.
const MIN_PASSWORD_LENGTH = 8;
// Email mínimo razonable.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    throw new Error(
      'El usuario debe tener entre 2 y 20 caracteres y solo letras, números, _, - o .'
    );
  }
  return trimmed;
}

export const userQueries = {
  async me(_: unknown, __: unknown, ctx: GqlContext) {
    if (!ctx.session?.user) return null;
    await connectToDatabase();
    const doc = await User.findById(ctx.session.user.id)
      .select('username email image imageKey allergens allergyNotes')
      .exec();
    const imageUrl = doc ? userImageUrl(doc) : null;
    return {
      id: ctx.session.user.id,
      username: ctx.session.user.username,
      email: ctx.session.user.email,
      imageUrl,
      allergens: doc?.allergens ?? [],
      allergyNotes: doc?.allergyNotes ?? null,
    };
  },

  async myStats(_: unknown, args: { groupSlug: string }, ctx: GqlContext) {
    await connectToDatabase();
    const { group, user } = await requireGroupAccess(ctx, {
      slug: args.groupSlug,
    });
    return computeUserStats(user.userKey, group._id as Types.ObjectId);
  },

  /**
   * Perfil de alguien **dentro de un grupo que compartes**. Hace falta ser
   * miembro para pedirlo, y solo cuenta la actividad en ese grupo: así no se
   * filtra en qué otros grupos está nadie.
   */
  async userStats(
    _: unknown,
    args: { groupSlug: string; username: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const { group } = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const usernameKey = normalizeUsername(args.username);
    if (!usernameKey) return null;

    const groupId = group._id as Types.ObjectId;
    // Miembro actual, o alguien que votó en el grupo (votos históricos o gente
    // que ya se fue). Si no es ninguna de las dos, para este grupo no existe.
    const [isMember, hasVotes] = await Promise.all([
      Membership.exists({ group: groupId, userKey: usernameKey }),
      Vote.exists({ group: groupId, userKey: usernameKey }),
    ]);
    if (!isMember && !hasVotes) return null;
    return computeUserStats(usernameKey, groupId);
  },
};

export const userMutations = {
  async register(
    _: unknown,
    args: { input: { username: string; email: string; password: string } }
  ) {
    await connectToDatabase();
    const username = validateUsername(args.input.username);
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
    });

    return {
      id: (doc._id as Types.ObjectId).toString(),
      username: doc.username,
      email: doc.email,
    };
  },

  async setUsername(
    _: unknown,
    args: { username: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    if (!ctx.session?.user) {
      throw new Error('Debes iniciar sesión.');
    }
    const username = validateUsername(args.username);
    const usernameKey = normalizeUsername(username);

    const existing = await User.findOne({ usernameKey }).exec();
    if (
      existing &&
      (existing._id as Types.ObjectId).toString() !== ctx.session.user.id
    ) {
      throw new Error('Ese usuario ya existe.');
    }

    const user = await User.findById(ctx.session.user.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');

    const previousKey = user.usernameKey;
    user.username = username;
    user.usernameKey = usernameKey;
    await user.save();

    // Las membresías van por usernameKey: si cambia (p. ej. la cuenta de Google
    // que sale de su clave provisional `g_…`), se mueven con ella.
    if (previousKey !== usernameKey) {
      await Membership.updateMany(
        { userKey: previousKey },
        { $set: { userKey: usernameKey, userName: username } }
      ).exec();
    }

    return {
      id: (user._id as Types.ObjectId).toString(),
      username: user.username,
      email: user.email,
      imageUrl: userImageUrl(user),
    };
  },

  async setProfileImage(
    _: unknown,
    args: {
      input: { imageBase64: string; imageContentType: string };
    },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const me = requireUser(ctx);
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

    const user = await User.findById(me.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');

    const ext = inferExtension(args.input.imageContentType);
    const newKey = `users/${(user._id as Types.ObjectId).toString()}-${randomUUID()}.${ext}`;

    await putObject(newKey, buffer, args.input.imageContentType);

    const oldKey = user.imageKey;
    user.imageKey = newKey;
    user.imageContentType = args.input.imageContentType;
    await user.save();

    // Limpiamos la imagen anterior (si la había). Errores no son críticos.
    if (oldKey && oldKey !== newKey) {
      await deleteObjectQuietly(
        oldKey,
        'No se pudo eliminar avatar anterior de R2:'
      );
    }

    return {
      id: (user._id as Types.ObjectId).toString(),
      username: user.username,
      email: user.email,
      imageUrl: userImageUrl(user),
    };
  },

  async setAllergies(
    _: unknown,
    args: {
      input: { allergens: string[]; allergyNotes?: string | null };
    },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const me = requireUser(ctx);
    const allergens = normalizeAllergens(args.input.allergens);
    const allergyNotes = normalizeAllergyNotes(args.input.allergyNotes);

    const user = await User.findById(me.id).exec();
    if (!user) throw new Error('Usuario no encontrado.');

    user.allergens = allergens;
    // `undefined` elimina el campo en vez de guardar un null.
    user.allergyNotes = allergyNotes ?? undefined;
    await user.save();

    return {
      id: (user._id as Types.ObjectId).toString(),
      username: user.username,
      email: user.email,
      imageUrl: userImageUrl(user),
      allergens: user.allergens,
      allergyNotes: user.allergyNotes ?? null,
    };
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
};
