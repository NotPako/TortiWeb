import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla, type TortillaDocument } from '@/models/Tortilla';
import { Vote, REACTIONS, type Reaction, type VoteDocument } from '@/models/Vote';
import { Comment, type CommentDocument } from '@/models/Comment';
import { TortillaEvent } from '@/models/TortillaEvent';
import { User, userImageUrl } from '@/models/User';
import { isSameDay } from '@/lib/dates';
import { requireUser, type GqlContext } from './context';
import {
  findGroupAccess,
  requireGroupAccess,
  requireGroupAdmin,
} from './access';
import {
  decodeBase64Image,
  deleteObjectQuietly,
  inferExtension,
  putObject,
} from './media';
import { tortillaPayload, type ResolvedTortilla } from './payloads';

const TORTILLA_NOT_FOUND = 'Tortilla no encontrada.';

/** Busca una tortilla por id; lanza con el mismo mensaje si el id es inválido. */
async function findTortillaOrThrow(id: string): Promise<TortillaDocument> {
  if (!Types.ObjectId.isValid(id)) throw new Error('ID de tortilla inválido.');
  const doc = await Tortilla.findById(id).exec();
  if (!doc) throw new Error(TORTILLA_NOT_FOUND);
  return doc;
}

/** Mapa usernameKey → URL de avatar, en una sola consulta. */
async function imagesByUserKey(
  keys: string[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(keys));
  const users = unique.length
    ? await User.find({ usernameKey: { $in: unique } })
        .select('usernameKey image imageKey')
        .exec()
    : [];
  return new Map(users.map((u) => [u.usernameKey, userImageUrl(u)]));
}

export const tortillaQueries = {
  async tortillas(
    _: unknown,
    args: { groupSlug: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const { group, user } = await requireGroupAccess(ctx, {
      slug: args.groupSlug,
    });
    const docs = await Tortilla.find({ group: group._id })
      .sort({ date: -1 })
      .exec();
    return Promise.all(docs.map((d) => tortillaPayload(d, user.userKey)));
  },

  async tortilla(_: unknown, args: { id: string }, ctx: GqlContext) {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(args.id)) return null;
    const doc = await Tortilla.findById(args.id).exec();
    if (!doc) return null;
    // Una tortilla de un grupo ajeno se comporta como si no existiera.
    const access = await findGroupAccess(ctx, { id: doc.group });
    if (!access) return null;
    return tortillaPayload(doc, access.user.userKey);
  },

  async currentTortillas(
    _: unknown,
    args: { groupSlug: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const { group, user } = await requireGroupAccess(ctx, {
      slug: args.groupSlug,
    });
    // La jornada "actual" es la del día de la tortilla más reciente del grupo,
    // y se votan **todas** las de ese día: a veces se cocinan dos distintas.
    // Subir una tortilla de un día posterior cierra la jornada anterior.
    const docs = await Tortilla.find({ group: group._id })
      .sort({ date: -1 })
      .exec();
    const latest = docs[0];
    if (!latest) return [];

    const openToday = docs.filter(
      (d) => isSameDay(d.date, latest.date) && !d.closedAt
    );
    return Promise.all(openToday.map((d) => tortillaPayload(d, user.userKey)));
  },
};

export const tortillaMutations = {
  async createTortilla(
    _: unknown,
    args: {
      input: {
        groupSlug: string;
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
    const { group, user } = await requireGroupAdmin(ctx, {
      slug: args.input.groupSlug,
    });

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

    await putObject(imageKey, buffer, args.input.imageContentType);

    let doc: TortillaDocument;
    try {
      doc = await Tortilla.create({
        group: group._id,
        name: args.input.name.trim(),
        description: args.input.description?.trim() || undefined,
        date: args.input.date ? new Date(args.input.date) : new Date(),
        imageKey,
        imageContentType: args.input.imageContentType,
      });
    } catch (err) {
      await deleteObjectQuietly(imageKey);
      throw err;
    }

    // Al subir la tortilla cocinada, cerramos la convocatoria abierta de ESTE
    // grupo; las de otros grupos no se tocan.
    await TortillaEvent.updateMany(
      { group: group._id, closedAt: null },
      { $set: { closedAt: new Date() } }
    ).exec();

    return tortillaPayload(doc, user.userKey);
  },

  async deleteTortilla(_: unknown, args: { id: string }, ctx: GqlContext) {
    await connectToDatabase();
    requireUser(ctx);
    const tortilla = await findTortillaOrThrow(args.id);
    await requireGroupAdmin(ctx, { id: tortilla.group }, TORTILLA_NOT_FOUND);

    await Vote.deleteMany({ tortilla: tortilla._id }).exec();
    await Comment.deleteMany({ tortilla: tortilla._id }).exec();
    await deleteObjectQuietly(
      tortilla.imageKey,
      'No se pudo eliminar el objeto de R2:'
    );

    await tortilla.deleteOne();
    return true;
  },

  async closeTortillaVoting(
    _: unknown,
    args: { id: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx);
    const tortilla = await findTortillaOrThrow(args.id);
    const { user } = await requireGroupAdmin(
      ctx,
      { id: tortilla.group },
      TORTILLA_NOT_FOUND
    );

    // Idempotente: si ya está cerrada, devolvemos el estado actual.
    if (!tortilla.closedAt) {
      tortilla.closedAt = new Date();
      await tortilla.save();
    }
    return tortillaPayload(tortilla, user.userKey);
  },

  async castVote(
    _: unknown,
    args: {
      input: { tortillaId: string; score: number; reaction?: Reaction | null };
    },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx, 'Debes iniciar sesión para votar.');

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

    const tortilla = await findTortillaOrThrow(tortillaId);
    const { group, user } = await requireGroupAccess(
      ctx,
      { id: tortilla.group },
      TORTILLA_NOT_FOUND
    );

    // Solo se vota la jornada en curso del grupo: la del día de su tortilla
    // más reciente. Cualquier tortilla de ese día es votable (a veces se
    // cocinan dos), y subir una de un día posterior cierra la anterior.
    const latest = await Tortilla.findOne({ group: group._id })
      .sort({ date: -1 })
      .select('date')
      .exec();
    if (!latest || !isSameDay(latest.date, tortilla.date)) {
      throw new Error(
        'La votación de esta tortilla ya está cerrada (hay una más reciente).'
      );
    }

    // Cierre manual por el admin.
    if (tortilla.closedAt) {
      throw new Error('La votación de esta tortilla está cerrada por el admin.');
    }

    const vote = await Vote.findOneAndUpdate(
      { tortilla: tortilla._id, userKey: user.userKey },
      {
        $set: {
          score: Math.round(score * 10) / 10,
          userName: user.userName,
          userKey: user.userKey,
          tortilla: tortilla._id,
          group: group._id,
          ...(reaction != null ? { reaction } : {}),
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
};

/**
 * Campos de `Tortilla`. No re-verifican acceso: el padre ya viene de una query
 * que lo comprobó, y filtran por su `_id`.
 */
export const tortillaFields = {
  async votes(parent: ResolvedTortilla) {
    await connectToDatabase();
    const docs = await Vote.find({ tortilla: parent._id })
      .sort({ createdAt: -1 })
      .exec();
    const imageByKey = await imagesByUserKey(docs.map((v) => v.userKey));
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
    const v = await Vote.findOne({ tortilla: parent._id, userKey }).exec();
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
    const imageByKey = await imagesByUserKey(docs.map((c) => c.userKey));
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
};
