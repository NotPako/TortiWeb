import { GraphQLScalarType, Kind } from 'graphql';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla, TortillaDocument } from '@/models/Tortilla';
import { Vote, VoteDocument, REACTIONS } from '@/models/Vote';
import type { Reaction } from '@/models/Vote';
import { Comment, CommentDocument } from '@/models/Comment';
import { TortillaEvent, TortillaEventDocument } from '@/models/TortillaEvent';
import { computeAchievements, type VoteForAchievements } from '@/lib/achievements';
import { isSameDay, nextWednesday } from '@/lib/dates';
import {
  User,
  normalizeEmail,
  normalizeUsername,
  userImageUrl,
} from '@/models/User';
import {
  getR2BucketName,
  getR2Client,
  publicUrlFor,
} from '@/lib/r2';
import type { Session } from 'next-auth';

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Fecha en formato ISO 8601',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  },
});

function decodeBase64Image(base64: string): Buffer {
  const match = base64.match(/^data:[^;]+;base64,(.+)$/);
  const raw = match ? match[1] : base64;
  return Buffer.from(raw, 'base64');
}

function inferExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
  };
  return map[contentType.toLowerCase()] ?? 'bin';
}

function buildImageUrl(doc: TortillaDocument): string {
  const direct = publicUrlFor(doc.imageKey);
  if (direct) return direct;
  return `/api/image/${(doc._id as Types.ObjectId).toString()}`;
}

async function computeStats(tortillaId: Types.ObjectId) {
  const stats = await Vote.aggregate<{
    _id: Types.ObjectId;
    avg: number;
    count: number;
  }>([
    { $match: { tortilla: tortillaId } },
    {
      $group: {
        _id: '$tortilla',
        avg: { $avg: '$score' },
        count: { $sum: 1 },
      },
    },
  ]);

  const stat = stats[0];
  return {
    averageScore: stat ? Number(stat.avg.toFixed(2)) : null,
    voteCount: stat ? stat.count : 0,
  };
}

export type GqlContext = {
  session: Session | null;
};

function sessionUserKey(session: Session | null): string | null {
  if (!session?.user?.usernameKey) return null;
  if (session.user.needsUsername) return null;
  return session.user.usernameKey;
}

/**
 * Exige que el usuario autenticado sea admin. La sesión transporta el rol, pero
 * lo reverificamos contra la BD para que un cambio de rol (p. ej. vía
 * `scripts/grant-admin.mjs`) surta efecto sin esperar a que caduque el JWT.
 */
async function requireAdmin(ctx: GqlContext): Promise<void> {
  if (!ctx.session?.user || ctx.session.user.needsUsername) {
    throw new Error('Debes iniciar sesión.');
  }
  const user = await User.findById(ctx.session.user.id).select('role').exec();
  if (!user || user.role !== 'admin') {
    throw new Error('No tienes permisos de administrador.');
  }
}

async function tortillaPayload(
  doc: TortillaDocument,
  userKey: string | null
) {
  const { averageScore, voteCount } = await computeStats(
    doc._id as Types.ObjectId
  );
  const closedAt = doc.closedAt ?? null;
  // En el modelo del proyecto la votación está abierta mientras la tortilla
  // siga siendo la última y no se haya cerrado manualmente. La condición de
  // "ser la última" se aplica en `currentTortilla` y `castVote`; aquí sólo
  // expresamos si está cerrada por el admin.
  const votingOpen = !closedAt;
  return {
    id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    description: doc.description ?? null,
    date: doc.date,
    imageUrl: buildImageUrl(doc),
    averageScore,
    voteCount,
    closedAt,
    votingOpen,
    _id: doc._id,
    _ctxUserKey: userKey,
  };
}

type ResolvedTortilla = Awaited<ReturnType<typeof tortillaPayload>>;

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

async function computeUserStats(userKey: string) {
  const voteDocs = await Vote.find({ userKey })
    .sort({ createdAt: -1 })
    .populate<{ tortilla: TortillaDocument }>('tortilla')
    .exec();

  // Display name: prefer canonical User.username; fallback al primer vote.userName.
  let username = userKey;
  let imageUrl: string | null = null;
  const userDoc = await User.findOne({ usernameKey: userKey })
    .select('username image imageKey')
    .exec();
  if (userDoc) {
    username = userDoc.username;
    imageUrl = userImageUrl(userDoc);
  } else if (voteDocs.length > 0) {
    username = voteDocs[0].userName;
  }

  const totalVotes = voteDocs.length;
  const averageGiven =
    totalVotes > 0
      ? Number(
          (voteDocs.reduce((s, v) => s + v.score, 0) / totalVotes).toFixed(2)
        )
      : null;

  const votes = voteDocs
    .filter((v) => v.tortilla)
    .map((v) => ({
      id: (v._id as Types.ObjectId).toString(),
      score: v.score,
      reaction: v.reaction ?? null,
      createdAt: v.createdAt,
      tortilla: {
        id: (v.tortilla._id as Types.ObjectId).toString(),
        name: v.tortilla.name,
        date: v.tortilla.date,
        imageUrl: buildImageUrl(v.tortilla),
      },
    }));

  const bestVote =
    votes.length > 0
      ? [...votes].sort((a, b) => b.score - a.score)[0]
      : null;

  const tortillaList = await Tortilla.find({})
    .sort({ date: -1 })
    .select('_id date')
    .exec();

  const votedIds = new Set(
    voteDocs
      .filter((v) => v.tortilla)
      .map((v) => (v.tortilla._id as Types.ObjectId).toString())
  );

  // Si la tortilla más reciente es de hoy y aún no se votó, no rompe la racha.
  let startIndex = 0;
  if (tortillaList.length > 0) {
    const first = tortillaList[0];
    const firstId = (first._id as Types.ObjectId).toString();
    if (isSameDay(first.date, new Date()) && !votedIds.has(firstId)) {
      startIndex = 1;
    }
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let runLength = 0;
  let foundFirstGap = false;
  for (let i = startIndex; i < tortillaList.length; i++) {
    const tid = (tortillaList[i]._id as Types.ObjectId).toString();
    if (votedIds.has(tid)) {
      runLength++;
      if (runLength > bestStreak) bestStreak = runLength;
    } else {
      if (!foundFirstGap) {
        currentStreak = runLength;
        foundFirstGap = true;
      }
      runLength = 0;
    }
  }
  if (!foundFirstGap) currentStreak = runLength;

  // Logros: necesitamos min/max por tortilla en las que votó el usuario.
  const userTortillaIds = voteDocs
    .filter((v) => v.tortilla)
    .map((v) => v.tortilla._id as Types.ObjectId);
  const userVotes: VoteForAchievements[] = voteDocs
    .filter((v) => v.tortilla)
    .map((v) => ({
      tortillaId: (v.tortilla._id as Types.ObjectId).toString(),
      score: v.score,
    }));
  const allRelevantVotesRaw = userTortillaIds.length
    ? await Vote.find({ tortilla: { $in: userTortillaIds } })
        .select('tortilla score')
        .exec()
    : [];
  const allRelevantVotes = allRelevantVotesRaw.map((v) => ({
    tortillaId: (v.tortilla as Types.ObjectId).toString(),
    score: v.score,
  }));
  const achievements = computeAchievements({
    totalVotes,
    bestStreak,
    userVotes,
    allRelevantVotes,
  });

  return {
    username,
    imageUrl,
    totalVotes,
    averageGiven,
    currentStreak,
    bestStreak,
    bestVote,
    votes,
    achievements,
  };
}

async function eventPayload(
  doc: TortillaEventDocument,
  userKey: string | null
) {
  const keys = Array.from(new Set(doc.attendees.map((a) => a.userKey)));
  const users = keys.length
    ? await User.find({ usernameKey: { $in: keys } })
        .select('usernameKey image imageKey')
        .exec()
    : [];
  const imageByKey = new Map<string, string | null>(
    users.map((u) => [u.usernameKey, userImageUrl(u)])
  );
  // Orden de llegada (joinedAt asc) para que la lista sea estable.
  const attendees = [...doc.attendees]
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((a) => ({
      userName: a.userName,
      imageUrl: imageByKey.get(a.userKey) ?? null,
    }));
  const closedAt = doc.closedAt ?? null;
  return {
    id: (doc._id as Types.ObjectId).toString(),
    date: doc.date,
    note: doc.note ?? null,
    attendees,
    attendeeCount: attendees.length,
    isAttending: userKey
      ? doc.attendees.some((a) => a.userKey === userKey)
      : false,
    closedAt,
    open: !closedAt,
  };
}

export const resolvers = {
  Date: dateScalar,

  Query: {
    async tortillas(_: unknown, __: unknown, ctx: GqlContext) {
      await connectToDatabase();
      const docs = await Tortilla.find({}).sort({ date: -1 }).exec();
      const userKey = sessionUserKey(ctx.session);
      return Promise.all(docs.map((d) => tortillaPayload(d, userKey)));
    },

    async tortilla(
      _: unknown,
      args: { id: string },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      if (!Types.ObjectId.isValid(args.id)) return null;
      const doc = await Tortilla.findById(args.id).exec();
      if (!doc) return null;
      return tortillaPayload(doc, sessionUserKey(ctx.session));
    },

    async currentTortilla(_: unknown, __: unknown, ctx: GqlContext) {
      await connectToDatabase();
      // La tortilla "actual" es siempre la más reciente subida. La votación se
      // cierra cuando se sube una nueva (no por fecha): así evitamos depender
      // de la zona horaria del servidor y de cómo el admin rellena la fecha.
      // Si el admin la cierra manualmente, también desaparece de /vote (sigue
      // accesible en el histórico).
      const doc = await Tortilla.findOne({}).sort({ date: -1 }).exec();
      if (!doc || doc.closedAt) return null;
      return tortillaPayload(doc, sessionUserKey(ctx.session));
    },

    async me(_: unknown, __: unknown, ctx: GqlContext) {
      if (!ctx.session?.user) return null;
      await connectToDatabase();
      const doc = await User.findById(ctx.session.user.id)
        .select('username email image imageKey')
        .exec();
      const imageUrl = doc ? userImageUrl(doc) : null;
      return {
        id: ctx.session.user.id,
        username: ctx.session.user.username,
        email: ctx.session.user.email,
        imageUrl,
      };
    },

    async myStats(_: unknown, __: unknown, ctx: GqlContext) {
      const userKey = sessionUserKey(ctx.session);
      if (!userKey) return null;
      await connectToDatabase();
      return computeUserStats(userKey);
    },

    async userStats(_: unknown, args: { username: string }) {
      await connectToDatabase();
      const usernameKey = normalizeUsername(args.username);
      if (!usernameKey) return null;
      return computeUserStats(usernameKey);
    },

    async upcomingTortilla(_: unknown, __: unknown, ctx: GqlContext) {
      await connectToDatabase();
      const doc = await TortillaEvent.findOne({ closedAt: null })
        .sort({ date: -1 })
        .exec();
      if (!doc) return null;
      return eventPayload(doc, sessionUserKey(ctx.session));
    },
  },

  Mutation: {
    async createTortilla(
      _: unknown,
      args: {
        input: {
          name: string;
          description?: string | null;
          imageBase64: string;
          imageContentType: string;
          date?: string | Date | null;
        };
      },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);

      const buffer = decodeBase64Image(args.input.imageBase64);
      if (buffer.length === 0) {
        throw new Error('La imagen está vacía o no es válida.');
      }
      if (buffer.length > 4 * 1024 * 1024) {
        throw new Error('La imagen no puede superar 4 MB.');
      }

      const ext = inferExtension(args.input.imageContentType);
      const dateSegment = new Date().toISOString().slice(0, 10);
      const imageKey = `tortillas/${dateSegment}-${randomUUID()}.${ext}`;

      await getR2Client().send(
        new PutObjectCommand({
          Bucket: getR2BucketName(),
          Key: imageKey,
          Body: buffer,
          ContentType: args.input.imageContentType,
        })
      );

      let doc: TortillaDocument;
      try {
        doc = await Tortilla.create({
          name: args.input.name.trim(),
          description: args.input.description?.trim() || undefined,
          date: args.input.date ? new Date(args.input.date) : new Date(),
          imageKey,
          imageContentType: args.input.imageContentType,
        });
      } catch (err) {
        try {
          await getR2Client().send(
            new DeleteObjectCommand({
              Bucket: getR2BucketName(),
              Key: imageKey,
            })
          );
        } catch {
          // ignore
        }
        throw err;
      }

      // Al subir la tortilla cocinada, cerramos cualquier convocatoria abierta.
      await TortillaEvent.updateMany(
        { closedAt: null },
        { $set: { closedAt: new Date() } }
      ).exec();

      return tortillaPayload(doc, null);
    },

    async deleteTortilla(
      _: unknown,
      args: { id: string },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);
      if (!Types.ObjectId.isValid(args.id)) {
        throw new Error('ID de tortilla inválido.');
      }

      const tortilla = await Tortilla.findById(args.id).exec();
      if (!tortilla) throw new Error('Tortilla no encontrada.');

      await Vote.deleteMany({ tortilla: tortilla._id }).exec();
      await Comment.deleteMany({ tortilla: tortilla._id }).exec();

      try {
        await getR2Client().send(
          new DeleteObjectCommand({
            Bucket: getR2BucketName(),
            Key: tortilla.imageKey,
          })
        );
      } catch (err) {
        console.warn('No se pudo eliminar el objeto de R2:', err);
      }

      await tortilla.deleteOne();
      return true;
    },

    async closeTortillaVoting(
      _: unknown,
      args: { id: string },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);
      if (!Types.ObjectId.isValid(args.id)) {
        throw new Error('ID de tortilla inválido.');
      }

      const tortilla = await Tortilla.findById(args.id).exec();
      if (!tortilla) throw new Error('Tortilla no encontrada.');
      if (tortilla.closedAt) {
        // Idempotente: si ya está cerrada, devolvemos el estado actual.
        return tortillaPayload(tortilla, sessionUserKey(ctx.session));
      }

      tortilla.closedAt = new Date();
      await tortilla.save();

      return tortillaPayload(tortilla, sessionUserKey(ctx.session));
    },

    async castVote(
      _: unknown,
      args: { input: { tortillaId: string; score: number; reaction?: Reaction | null } },
      ctx: GqlContext
    ) {
      await connectToDatabase();

      if (!ctx.session?.user || ctx.session.user.needsUsername) {
        throw new Error('Debes iniciar sesión para votar.');
      }

      const { tortillaId, score, reaction } = args.input;
      if (!Types.ObjectId.isValid(tortillaId)) {
        throw new Error('ID de tortilla inválido.');
      }
      if (
        typeof score !== 'number' ||
        Number.isNaN(score) ||
        score < 0 ||
        score > 10
      ) {
        throw new Error('La puntuación debe estar entre 0 y 10.');
      }
      if (reaction != null && !REACTIONS.includes(reaction)) {
        throw new Error('Reacción no válida.');
      }

      const tortilla = await Tortilla.findById(tortillaId).exec();
      if (!tortilla) throw new Error('Tortilla no encontrada.');

      // Solo se permite votar la tortilla más reciente: cuando se sube una
      // nueva, las anteriores quedan cerradas automáticamente.
      const latest = await Tortilla.findOne({}).sort({ date: -1 }).exec();
      if (
        !latest ||
        (latest._id as Types.ObjectId).toString() !==
          (tortilla._id as Types.ObjectId).toString()
      ) {
        throw new Error(
          'La votación de esta tortilla ya está cerrada (hay una más reciente).'
        );
      }

      // Cierre manual por el admin.
      if (tortilla.closedAt) {
        throw new Error(
          'La votación de esta tortilla está cerrada por el admin.'
        );
      }

      const userKey = ctx.session.user.usernameKey;
      const userName = ctx.session.user.username;

      const reactionUpdate: Record<string, unknown> =
        reaction != null
          ? { reaction }
          : {};

      const vote = await Vote.findOneAndUpdate(
        { tortilla: tortilla._id, userKey },
        {
          $set: {
            score: Math.round(score * 10) / 10,
            userName,
            userKey,
            tortilla: tortilla._id,
            ...reactionUpdate,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();

      return {
        id: (vote._id as Types.ObjectId).toString(),
        userName: vote.userName,
        score: vote.score,
        reaction: vote.reaction ?? null,
        createdAt: vote.createdAt,
      };
    },

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

      user.username = username;
      user.usernameKey = usernameKey;
      await user.save();

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
      if (!ctx.session?.user || ctx.session.user.needsUsername) {
        throw new Error('Debes iniciar sesión.');
      }
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

      const user = await User.findById(ctx.session.user.id).exec();
      if (!user) throw new Error('Usuario no encontrado.');

      const ext = inferExtension(args.input.imageContentType);
      const newKey = `users/${(user._id as Types.ObjectId).toString()}-${randomUUID()}.${ext}`;

      await getR2Client().send(
        new PutObjectCommand({
          Bucket: getR2BucketName(),
          Key: newKey,
          Body: buffer,
          ContentType: args.input.imageContentType,
        })
      );

      const oldKey = user.imageKey;
      user.imageKey = newKey;
      user.imageContentType = args.input.imageContentType;
      await user.save();

      // Limpiamos la imagen anterior (si la había). Errores no son críticos.
      if (oldKey && oldKey !== newKey) {
        try {
          await getR2Client().send(
            new DeleteObjectCommand({
              Bucket: getR2BucketName(),
              Key: oldKey,
            })
          );
        } catch (err) {
          console.warn('No se pudo eliminar avatar anterior de R2:', err);
        }
      }

      return {
        id: (user._id as Types.ObjectId).toString(),
        username: user.username,
        email: user.email,
        imageUrl: userImageUrl(user),
      };
    },

    async addComment(
      _: unknown,
      args: { input: { tortillaId: string; text: string } },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      if (!ctx.session?.user || ctx.session.user.needsUsername) {
        throw new Error('Debes iniciar sesión para comentar.');
      }
      if (!Types.ObjectId.isValid(args.input.tortillaId)) {
        throw new Error('ID de tortilla inválido.');
      }
      const text = args.input.text.trim();
      if (!text) throw new Error('El comentario no puede estar vacío.');
      if (text.length > 500) {
        throw new Error('El comentario no puede superar 500 caracteres.');
      }

      const tortilla = await Tortilla.findById(args.input.tortillaId)
        .select('_id')
        .exec();
      if (!tortilla) throw new Error('Tortilla no encontrada.');

      const userKey = ctx.session.user.usernameKey;
      const userName = ctx.session.user.username;

      const doc = await Comment.create({
        tortilla: tortilla._id,
        userKey,
        userName,
        text,
      });

      // Resolvemos la imagen del autor para mantener simetría con el resolver.
      const userDoc = await User.findOne({ usernameKey: userKey })
        .select('image imageKey')
        .exec();
      const imageUrl = userDoc ? userImageUrl(userDoc) : null;

      return {
        id: (doc._id as Types.ObjectId).toString(),
        userName: doc.userName,
        text: doc.text,
        createdAt: doc.createdAt,
        imageUrl,
        isMine: true,
      };
    },

    async deleteComment(
      _: unknown,
      args: { id: string },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      if (!ctx.session?.user || ctx.session.user.needsUsername) {
        throw new Error('Debes iniciar sesión.');
      }
      if (!Types.ObjectId.isValid(args.id)) {
        throw new Error('ID de comentario inválido.');
      }
      const doc = await Comment.findById(args.id).exec();
      if (!doc) throw new Error('Comentario no encontrado.');
      if (doc.userKey !== ctx.session.user.usernameKey) {
        throw new Error('Sólo puedes borrar tus propios comentarios.');
      }
      await doc.deleteOne();
      return true;
    },

    async announceTortilla(
      _: unknown,
      args: { input: { date?: string | Date | null; note?: string | null } },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);

      const existing = await TortillaEvent.findOne({ closedAt: null }).exec();
      if (existing) {
        throw new Error(
          'Ya hay una convocatoria abierta. Ciérrala antes de crear otra.'
        );
      }

      const date = args.input.date
        ? new Date(args.input.date)
        : nextWednesday();
      const note = args.input.note?.trim() || undefined;

      const doc = await TortillaEvent.create({
        date,
        note,
        attendees: [],
        announcedByKey: ctx.session!.user.usernameKey,
      });

      return eventPayload(doc, sessionUserKey(ctx.session));
    },

    async closeTortillaEvent(
      _: unknown,
      args: { id: string },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);
      if (!Types.ObjectId.isValid(args.id)) {
        throw new Error('ID de convocatoria inválido.');
      }
      const doc = await TortillaEvent.findById(args.id).exec();
      if (!doc) throw new Error('Convocatoria no encontrada.');
      if (!doc.closedAt) {
        doc.closedAt = new Date();
        await doc.save();
      }
      return eventPayload(doc, sessionUserKey(ctx.session));
    },

    async setAttendance(
      _: unknown,
      args: { id: string; attending: boolean },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      if (!ctx.session?.user || ctx.session.user.needsUsername) {
        throw new Error('Debes iniciar sesión para apuntarte.');
      }
      if (!Types.ObjectId.isValid(args.id)) {
        throw new Error('ID de convocatoria inválido.');
      }
      const doc = await TortillaEvent.findById(args.id).exec();
      if (!doc) throw new Error('Convocatoria no encontrada.');
      if (doc.closedAt) {
        throw new Error('Esta convocatoria está cerrada.');
      }

      const userKey = ctx.session.user.usernameKey;
      const userName = ctx.session.user.username;
      const idx = doc.attendees.findIndex((a) => a.userKey === userKey);

      if (args.attending && idx === -1) {
        doc.attendees.push({ userKey, userName, joinedAt: new Date() });
        await doc.save();
      } else if (!args.attending && idx !== -1) {
        doc.attendees.splice(idx, 1);
        await doc.save();
      }

      return eventPayload(doc, userKey);
    },
  },

  Tortilla: {
    async votes(parent: ResolvedTortilla) {
      await connectToDatabase();
      const docs = await Vote.find({ tortilla: parent._id })
        .sort({ createdAt: -1 })
        .exec();
      const keys = Array.from(new Set(docs.map((v) => v.userKey)));
      const users = keys.length
        ? await User.find({ usernameKey: { $in: keys } })
            .select('usernameKey image imageKey')
            .exec()
        : [];
      const imageByKey = new Map<string, string | null>(
        users.map((u) => [u.usernameKey, userImageUrl(u)])
      );
      return docs.map((v: VoteDocument) => ({
        id: (v._id as Types.ObjectId).toString(),
        userName: v.userName,
        score: v.score,
        reaction: v.reaction ?? null,
        createdAt: v.createdAt,
        imageUrl: imageByKey.get(v.userKey) ?? null,
      }));
    },

    async myVote(parent: ResolvedTortilla) {
      const userKey = parent._ctxUserKey;
      if (!userKey) return null;
      await connectToDatabase();
      const v = await Vote.findOne({
        tortilla: parent._id,
        userKey,
      }).exec();
      if (!v) return null;
      return {
        id: (v._id as Types.ObjectId).toString(),
        userName: v.userName,
        score: v.score,
        reaction: v.reaction ?? null,
        createdAt: v.createdAt,
      };
    },

    async comments(parent: ResolvedTortilla) {
      await connectToDatabase();
      const docs = await Comment.find({ tortilla: parent._id })
        .sort({ createdAt: 1 })
        .exec();
      const keys = Array.from(new Set(docs.map((c) => c.userKey)));
      const users = keys.length
        ? await User.find({ usernameKey: { $in: keys } })
            .select('usernameKey image imageKey')
            .exec()
        : [];
      const imageByKey = new Map<string, string | null>(
        users.map((u) => [u.usernameKey, userImageUrl(u)])
      );
      const myKey = parent._ctxUserKey;
      return docs.map((c: CommentDocument) => ({
        id: (c._id as Types.ObjectId).toString(),
        userName: c.userName,
        text: c.text,
        createdAt: c.createdAt,
        imageUrl: imageByKey.get(c.userKey) ?? null,
        isMine: myKey === c.userKey,
      }));
    },
  },
};
