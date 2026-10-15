import { GraphQLScalarType, Kind } from 'graphql';
import mongoose, { Types } from 'mongoose';
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
import {
  computeAchievements,
  isAchievementId,
  unseenAchievements,
  visibleAchievements,
} from '@/lib/achievements';
import { isSameDay, nextWednesday } from '@/lib/dates';
import { computeStreaks } from '@/lib/streak';
import {
  MIN_VOTES_PER_TORTILLA,
  MIN_VOTES_PER_VOTER,
  computeRanking,
  type RankedVoter,
} from '@/lib/ranking';
import { MAX_COMMENT_LENGTH, normalizeCommentText } from '@/lib/comments';
import { normalizeAllergens, normalizeAllergyNotes } from '@/lib/allergens';
import {
  join as joinSpots,
  leave as leaveSpots,
  pendingRequests,
  requestStatusFor,
  review as reviewSpots,
  validateCapacity,
  type SpotsState,
} from '@/lib/eventSpots';
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

/**
 * Identidad del usuario autenticado. El `id` es la referencia buena: el nombre
 * puede cambiar y la clave normalizada con él, pero el id no.
 */
export type CtxUser = {
  id: Types.ObjectId;
  key: string;
  name: string;
};

/** El subdocumento de Mongoose lleva más cosas: devolvemos solo día y mes. */
function birthdayPayload(b: Birthday | null | undefined): Birthday | null {
  return b ? { day: b.day, month: b.month } : null;
}

function sessionUser(session: Session | null): CtxUser | null {
  const user = session?.user;
  if (!user?.usernameKey || user.needsUsername) return null;
  if (!Types.ObjectId.isValid(user.id)) return null;
  return {
    id: new Types.ObjectId(user.id),
    key: user.usernameKey,
    name: user.username,
  };
}

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

/** Avatares por id de usuario, en una sola consulta. */
async function imagesByUserId(
  ids: (Types.ObjectId | undefined)[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(
    new Map(
      ids.filter((id): id is Types.ObjectId => Boolean(id)).map((id) => [id.toString(), id])
    ).values()
  );
  const users = unique.length
    ? await User.find({ _id: { $in: unique } })
        .select('image imageKey')
        .exec()
    : [];
  return new Map(
    users.map((u) => [(u._id as Types.ObjectId).toString(), userImageUrl(u)])
  );
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
  viewer: CtxUser | null
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
    _ctxUserId: viewer?.id ?? null,
  };
}

type ResolvedTortilla = Awaited<ReturnType<typeof tortillaPayload>>;

// Password: mínimo 8 caracteres.
const MIN_PASSWORD_LENGTH = 8;
// Email mínimo razonable.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Estadísticas de una persona. Con cuenta se buscan sus votos por id, así que
 * renombrarse no pierde el historial. Sin cuenta (votos históricos anteriores
 * al registro) solo queda el nombre.
 */
/**
 * Reúne lo que necesitan los logros: los votos y comentarios de los demás en
 * las mismas tortillas (para "el más duro", "Oráculo", "Madrugador"…), qué
 * tortillas ya cerraron y a cuántas convocatorias se apuntó.
 */
async function achievementsFor(args: {
  userId: Types.ObjectId | null;
  userKey: string;
  voteDocs: {
    _id: unknown;
    score: number;
    reaction?: Reaction | null;
    createdAt: Date;
    updatedAt: Date;
    tortilla: TortillaDocument | null;
  }[];
  tortillaList: Pick<TortillaDocument, '_id' | 'date' | 'closedAt'>[];
  totalVotes: number;
  bestStreak: number;
}) {
  const { userId, userKey, tortillaList } = args;
  const voteDocs = args.voteDocs.filter(
    (v): v is typeof v & { tortilla: TortillaDocument } => Boolean(v.tortilla)
  );
  const myVoteIds = new Set(voteDocs.map((v) => String(v._id)));
  const userTortillaIds = voteDocs.map((v) => v.tortilla._id as Types.ObjectId);

  // Igual que con los votos: por cuenta o, sin cuenta, por nombre.
  const ownFilter = userId
    ? { user: userId }
    : { userKey, user: { $exists: false } };
  const myComments = await Comment.find(ownFilter)
    .select('_id tortilla text')
    .exec();
  const myCommentIds = new Set(myComments.map((c) => String(c._id)));
  const commentedTortillaIds = [...new Set(myComments.map((c) => String(c.tortilla)))];

  const [relevantVoteDocs, relevantCommentDocs, attendedEvents] = await Promise.all([
    userTortillaIds.length
      ? Vote.find({ tortilla: { $in: userTortillaIds } })
          .select('_id tortilla score createdAt')
          .exec()
      : [],
    commentedTortillaIds.length
      ? Comment.find({ tortilla: { $in: commentedTortillaIds } })
          .select('_id tortilla createdAt')
          .exec()
      : [],
    TortillaEvent.countDocuments(
      userId
        ? { 'attendees.user': userId }
        : { attendees: { $elemMatch: { userKey, user: { $exists: false } } } }
    ).exec(),
  ]);

  // La votación terminó si se cerró a mano o si ya hay una jornada posterior.
  const latest = tortillaList[0];
  const finishedTortillaIds = tortillaList
    .filter((t) => t.closedAt || (latest && !isSameDay(t.date, latest.date)))
    .map((t) => String(t._id));

  return computeAchievements({
    totalVotes: args.totalVotes,
    bestStreak: args.bestStreak,
    userVotes: voteDocs.map((v) => ({
      tortillaId: String(v.tortilla._id),
      score: v.score,
      reaction: v.reaction ?? null,
      tortillaDate: v.tortilla.date,
      castAt: [v.createdAt, v.updatedAt],
    })),
    allRelevantVotes: relevantVoteDocs.map((v) => ({
      tortillaId: String(v.tortilla),
      score: v.score,
      createdAt: v.createdAt,
      mine: myVoteIds.has(String(v._id)),
    })),
    finishedTortillaIds,
    relevantComments: relevantCommentDocs.map((c) => ({
      tortillaId: String(c.tortilla),
      createdAt: c.createdAt,
      mine: myCommentIds.has(String(c._id)),
    })),
    myCommentTexts: myComments.map((c) => c.text),
    attendedEvents,
  });
}

async function computeUserStats(target: {
  userId: Types.ObjectId | null;
  userKey: string;
}) {
  const { userId, userKey } = target;
  const voteFilter = userId
    ? { user: userId }
    : { userKey, user: { $exists: false } };
  const voteDocs = await Vote.find(voteFilter)
    .sort({ createdAt: -1 })
    .populate<{ tortilla: TortillaDocument }>('tortilla')
    .exec();

  // Display name: prefer canonical User.username; fallback al primer vote.userName.
  let username = userKey;
  let imageUrl: string | null = null;
  const userDoc = userId
    ? await User.findById(userId).select('username image imageKey').exec()
    : null;
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
    .select('_id date closedAt')
    .exec();

  const votedIds = new Set(
    voteDocs
      .filter((v) => v.tortilla)
      .map((v) => (v.tortilla._id as Types.ObjectId).toString())
  );

  // La racha se cuenta por día, no por tortilla: si un día hubo dos, haber
  // votado cualquiera de ellas mantiene la racha.
  const { currentStreak, bestStreak } = computeStreaks({
    tortillas: tortillaList.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      date: d.date,
    })),
    votedTortillaIds: votedIds,
  });

  // Los ocultos no se mandan hasta desbloquearlos: ni siquiera su existencia.
  const allAchievements = await achievementsFor({
    userId,
    userKey,
    voteDocs,
    tortillaList,
    totalVotes,
    bestStreak,
  });
  const achievements = visibleAchievements(allAchievements);

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

/** Plazas del documento como estado plano para `eventSpots`. */
function spotsStateOf(doc: TortillaEventDocument): SpotsState {
  return {
    capacity: doc.capacity,
    attendees: doc.attendees.map((a) => ({
      // Apuntados anteriores a la migración por id: no coinciden con nadie.
      user: a.user?.toString() ?? '',
      userKey: a.userKey,
      userName: a.userName,
      joinedAt: a.joinedAt,
    })),
    requests: doc.requests.map((r) => ({
      user: r.user.toString(),
      userKey: r.userKey,
      userName: r.userName,
      requestedAt: r.requestedAt,
      status: r.status,
    })),
  };
}

function writeSpotsState(doc: TortillaEventDocument, state: SpotsState) {
  doc.set(
    'attendees',
    state.attendees.map((a) => ({
      user: a.user ? new Types.ObjectId(a.user) : undefined,
      userKey: a.userKey,
      userName: a.userName,
      joinedAt: a.joinedAt,
    }))
  );
  doc.set(
    'requests',
    state.requests.map((r) => ({
      user: new Types.ObjectId(r.user),
      userKey: r.userKey,
      userName: r.userName,
      requestedAt: r.requestedAt,
      status: r.status,
    }))
  );
}

/**
 * Carga la convocatoria, aplica un cambio de plazas y guarda. Si otra
 * petición guardó entre medias (dos personas a por la última plaza), el
 * esquema lanza VersionError y se repite con el estado nuevo.
 */
async function updateEventSpots(
  id: string,
  change: (state: SpotsState) => void
): Promise<TortillaEventDocument> {
  for (let attempt = 1; ; attempt++) {
    const doc = await TortillaEvent.findById(id).exec();
    if (!doc) throw new Error('Convocatoria no encontrada.');
    if (doc.closedAt) throw new Error('Esta convocatoria está cerrada.');
    const state = spotsStateOf(doc);
    change(state);
    writeSpotsState(doc, state);
    try {
      await doc.save();
      return doc;
    } catch (err) {
      if (err instanceof mongoose.Error.VersionError && attempt < 5) continue;
      throw err;
    }
  }
}

async function eventPayload(
  doc: TortillaEventDocument,
  viewer: CtxUser | null
) {
  // El visitante entra en la misma consulta: necesitamos su rol para decidir
  // si puede ver las alergias, sin un segundo viaje a la BD.
  const ids = [...doc.attendees, ...doc.requests]
    .map((a) => a.user)
    .filter((id): id is Types.ObjectId => Boolean(id));
  if (viewer) ids.push(viewer.id);
  const users = ids.length
    ? await User.find({ _id: { $in: ids } })
        .select('image imageKey role allergens allergyNotes')
        .exec()
    : [];
  const userById = new Map(
    users.map((u) => [(u._id as Types.ObjectId).toString(), u])
  );

  const isAttending = viewer
    ? doc.attendees.some((a) => a.user?.equals(viewer.id))
    : false;
  // Las alergias son datos de salud: solo las ven los admins (el rol se lee de
  // la BD, no del JWT) y quienes están apuntados a esta misma convocatoria.
  // Para el resto van a null, que NO significa "sin alergias".
  const isAdmin = viewer
    ? userById.get(viewer.id.toString())?.role === 'admin'
    : false;
  const canSeeAllergies = isAttending || isAdmin;

  const state = spotsStateOf(doc);
  const myRequest = viewer ? requestStatusFor(state, viewer.id.toString()) : null;
  const pending = pendingRequests(state);

  // Orden de llegada (joinedAt asc) para que la lista sea estable.
  const attendees = [...doc.attendees]
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((a) => {
      const user = a.user ? userById.get(a.user.toString()) : undefined;
      return {
        userName: a.userName,
        imageUrl: user ? userImageUrl(user) : null,
        allergens: canSeeAllergies ? (user?.allergens ?? []) : null,
        allergyNotes: canSeeAllergies ? (user?.allergyNotes ?? null) : null,
      };
    });
  const closedAt = doc.closedAt ?? null;
  return {
    id: (doc._id as Types.ObjectId).toString(),
    date: doc.date,
    note: doc.note ?? null,
    attendees,
    attendeeCount: attendees.length,
    capacity: doc.capacity,
    isAttending,
    myRequestStatus: myRequest ? myRequest.status.toUpperCase() : null,
    myQueuePosition: myRequest?.position ?? null,
    pendingRequestCount: pending.length,
    // La cola con nombres solo la ve el admin, que es quien decide.
    pendingRequests: isAdmin
      ? pending.map((r) => {
          const user = userById.get(r.user);
          return {
            userId: r.user,
            userName: r.userName,
            imageUrl: user ? userImageUrl(user) : null,
            requestedAt: r.requestedAt,
          };
        })
      : null,
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
      const viewer = sessionUser(ctx.session);
      return Promise.all(docs.map((d) => tortillaPayload(d, viewer)));
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
      return tortillaPayload(doc, sessionUser(ctx.session));
    },

    async currentTortillas(_: unknown, __: unknown, ctx: GqlContext) {
      await connectToDatabase();
      // La jornada "actual" es la del día de la tortilla más reciente, y se
      // votan **todas** las de ese día: a veces se cocinan dos distintas.
      // Subir una tortilla de un día posterior cierra la jornada anterior.
      const latest = await Tortilla.findOne({}).sort({ date: -1 }).exec();
      if (!latest) return [];

      const docs = await Tortilla.find({}).sort({ date: -1 }).exec();
      const openToday = docs.filter(
        (d) => isSameDay(d.date, latest.date) && !d.closedAt
      );

      const viewer = sessionUser(ctx.session);
      return Promise.all(openToday.map((d) => tortillaPayload(d, viewer)));
    },

    async me(_: unknown, __: unknown, ctx: GqlContext) {
      if (!ctx.session?.user) return null;
      await connectToDatabase();
      const doc = await User.findById(ctx.session.user.id)
        .select(
          'username email image imageKey allergens allergyNotes nicknameChanges birthday'
        )
        .exec();
      const imageUrl = doc ? userImageUrl(doc) : null;
      return {
        id: ctx.session.user.id,
        // El nombre sale de la BD: si se cambió hace un momento, el JWT
        // todavía lleva el anterior.
        username: doc?.username ?? ctx.session.user.username,
        email: doc?.email ?? ctx.session.user.email,
        imageUrl,
        allergens: doc?.allergens ?? [],
        allergyNotes: doc?.allergyNotes ?? null,
        nicknameChangesLeft: nicknameChangesLeft(doc?.nicknameChanges ?? 0),
        birthday: birthdayPayload(doc?.birthday),
      };
    },

    async ranking() {
      await connectToDatabase();
      const [tortillaDocs, voteDocs] = await Promise.all([
        Tortilla.find({}).sort({ date: -1 }).exec(),
        Vote.find({}).select('tortilla user userKey userName score').lean().exec(),
      ]);

      // Una persona es su cuenta; los votos históricos sin cuenta, su nombre.
      const voterKeyOf = (v: (typeof voteDocs)[number]) =>
        v.user ? `id:${v.user.toString()}` : `name:${v.userKey}`;
      const ranking = computeRanking({
        tortillas: tortillaDocs.map((d) => ({
          id: (d._id as Types.ObjectId).toString(),
          date: d.date,
        })),
        votes: voteDocs.map((v) => ({
          tortillaId: (v.tortilla as Types.ObjectId).toString(),
          voterKey: voterKeyOf(v),
          score: v.score,
        })),
      });

      const podiums = [
        ranking.toughest,
        ranking.generous,
        ranking.streaks,
        ranking.mostVotes,
      ];
      const userIds = [
        ...new Set(
          podiums
            .flat()
            .filter((r) => r.voterKey.startsWith('id:'))
            .map((r) => r.voterKey.slice(3))
        ),
      ];
      const users = userIds.length
        ? await User.find({ _id: { $in: userIds } })
            .select('username image imageKey')
            .exec()
        : [];
      const userById = new Map(
        users.map((u) => [(u._id as Types.ObjectId).toString(), u])
      );
      const nameByKey = new Map(voteDocs.map((v) => [voterKeyOf(v), v.userName]));
      const voterPayload = (r: RankedVoter) => {
        const user = r.voterKey.startsWith('id:')
          ? userById.get(r.voterKey.slice(3))
          : undefined;
        return {
          userName: user?.username ?? nameByKey.get(r.voterKey) ?? '?',
          imageUrl: user ? userImageUrl(user) : null,
          value: r.value,
          voteCount: r.voteCount,
        };
      };

      const tortillaById = new Map(
        tortillaDocs.map((d) => [(d._id as Types.ObjectId).toString(), d])
      );
      return {
        year: ranking.year,
        bestTortillas: ranking.bestTortillas.flatMap((r) => {
          const doc = tortillaById.get(r.tortillaId);
          if (!doc) return [];
          return [
            {
              tortilla: {
                id: r.tortillaId,
                name: doc.name,
                date: doc.date,
                imageUrl: buildImageUrl(doc),
              },
              averageScore: r.average,
              voteCount: r.voteCount,
            },
          ];
        }),
        toughest: ranking.toughest.map(voterPayload),
        generous: ranking.generous.map(voterPayload),
        streaks: ranking.streaks.map(voterPayload),
        mostVotes: ranking.mostVotes.map(voterPayload),
        minVotesPerTortilla: MIN_VOTES_PER_TORTILLA,
        minVotesPerVoter: MIN_VOTES_PER_VOTER,
      };
    },

    async birthdaysToday() {
      await connectToDatabase();
      const docs = await User.find({
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

    async myStats(_: unknown, __: unknown, ctx: GqlContext) {
      const viewer = sessionUser(ctx.session);
      if (!viewer) return null;
      await connectToDatabase();
      return computeUserStats({ userId: viewer.id, userKey: viewer.key });
    },

    async newAchievements(_: unknown, __: unknown, ctx: GqlContext) {
      const viewer = sessionUser(ctx.session);
      if (!viewer) return [];
      await connectToDatabase();
      const doc = await User.findById(viewer.id)
        .select('seenAchievements')
        .lean()
        .exec();
      if (!doc) return [];
      const { achievements } = await computeUserStats({
        userId: viewer.id,
        userKey: viewer.key,
      });
      if (!doc.seenAchievements) {
        // Primera vez: lo que ya tenía no es "nuevo".
        await User.updateOne(
          { _id: viewer.id, seenAchievements: { $exists: false } },
          {
            $set: {
              seenAchievements: achievements
                .filter((a) => a.unlocked)
                .map((a) => a.id),
            },
          }
        ).exec();
        return [];
      }
      return unseenAchievements(achievements, doc.seenAchievements);
    },

    async userStats(_: unknown, args: { username: string }) {
      await connectToDatabase();
      const usernameKey = normalizeUsername(args.username);
      if (!usernameKey) return null;
      // Si hay cuenta con ese nombre, sus estadísticas son las del id. Si no,
      // puede ser un votante histórico sin cuenta: se busca por nombre.
      const userDoc = await User.findOne({ usernameKey }).select('_id').exec();
      return computeUserStats({
        userId: (userDoc?._id as Types.ObjectId) ?? null,
        userKey: usernameKey,
      });
    },

    async upcomingTortilla(_: unknown, __: unknown, ctx: GqlContext) {
      await connectToDatabase();
      const doc = await TortillaEvent.findOne({ closedAt: null })
        .sort({ date: -1 })
        .exec();
      if (!doc) return null;
      return eventPayload(doc, sessionUser(ctx.session));
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
        return tortillaPayload(tortilla, sessionUser(ctx.session));
      }

      tortilla.closedAt = new Date();
      await tortilla.save();

      return tortillaPayload(tortilla, sessionUser(ctx.session));
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

      // Solo se vota la jornada en curso: la del día de la tortilla más
      // reciente. Cualquier tortilla de ese mismo día es votable (a veces se
      // cocinan dos), y subir una de un día posterior cierra la anterior.
      const latest = await Tortilla.findOne({})
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
        throw new Error(
          'La votación de esta tortilla está cerrada por el admin.'
        );
      }

      const viewer = sessionUser(ctx.session);
      if (!viewer) throw new Error('Debes iniciar sesión para votar.');

      const reactionUpdate: Record<string, unknown> =
        reaction != null
          ? { reaction }
          : {};

      // El voto se identifica por id de usuario: si esta persona se renombra,
      // sigue siendo el mismo voto.
      const vote = await Vote.findOneAndUpdate(
        { tortilla: tortilla._id, user: viewer.id },
        {
          $set: {
            score: Math.round(score * 10) / 10,
            user: viewer.id,
            userName: viewer.name,
            userKey: viewer.key,
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

      const birthday = args.input.birthday
        ? validateBirthday(args.input.birthday)
        : undefined;

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
      // con el mismo nombre, como hasta ahora.
      await claimDocsByName(doc._id as Types.ObjectId, usernameKey);

      return {
        id: (doc._id as Types.ObjectId).toString(),
        username: doc.username,
        email: doc.email,
      };
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
      if (birthday) user.birthday = birthday;
      await user.save();
      // Es el primer nombre de la cuenta (login con Google), no un cambio: no
      // gasta cupo y sí recupera los votos que dejó antes de registrarse.
      await claimDocsByName(user._id as Types.ObjectId, usernameKey);

      return {
        id: (user._id as Types.ObjectId).toString(),
        username: user.username,
        email: user.email,
        imageUrl: userImageUrl(user),
      };
    },

    async changeNickname(
      _: unknown,
      args: { username: string },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      const viewer = sessionUser(ctx.session);
      if (!viewer) throw new Error('Debes iniciar sesión.');

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

        // Votos, comentarios y apuntados guardan una copia del nombre para
        // mostrarlo sin más consultas: hay que refrescarla. La referencia de
        // verdad (el id) no se toca.
        const rename = {
          $set: { userName: change.username, userKey: change.usernameKey },
        };
        await Promise.all([
          Vote.updateMany({ user: user._id }, rename).exec(),
          Comment.updateMany({ user: user._id }, rename).exec(),
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
        id: (user._id as Types.ObjectId).toString(),
        username: user.username,
        email: user.email,
        imageUrl: userImageUrl(user),
        allergens: user.allergens,
        allergyNotes: user.allergyNotes ?? null,
        nicknameChangesLeft: nicknameChangesLeft(user.nicknameChanges ?? 0),
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

    async setAllergies(
      _: unknown,
      args: {
        input: { allergens: string[]; allergyNotes?: string | null };
      },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      if (!ctx.session?.user || ctx.session.user.needsUsername) {
        throw new Error('Debes iniciar sesión.');
      }
      const allergens = normalizeAllergens(args.input.allergens);
      const allergyNotes = normalizeAllergyNotes(args.input.allergyNotes);

      const user = await User.findById(ctx.session.user.id).exec();
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

    async markAchievementsSeen(
      _: unknown,
      args: { ids: string[] },
      ctx: GqlContext
    ) {
      const viewer = sessionUser(ctx.session);
      if (!viewer) throw new Error('Debes iniciar sesión.');
      const ids = [...new Set(args.ids)].filter(isAchievementId);
      if (ids.length === 0) return true;
      await connectToDatabase();
      await User.updateOne(
        { _id: viewer.id },
        { $addToSet: { seenAchievements: { $each: ids } } }
      ).exec();
      return true;
    },

    async setBirthday(
      _: unknown,
      args: { birthday?: Birthday | null },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      const viewer = sessionUser(ctx.session);
      if (!viewer) throw new Error('Debes iniciar sesión.');
      const birthday = args.birthday ? validateBirthday(args.birthday) : null;

      const user = await User.findById(viewer.id).exec();
      if (!user) throw new Error('Usuario no encontrado.');
      // `undefined` elimina el campo en vez de guardar un null.
      user.birthday = birthday ?? undefined;
      await user.save();

      return {
        id: (user._id as Types.ObjectId).toString(),
        username: user.username,
        email: user.email,
        imageUrl: userImageUrl(user),
        birthday: birthdayPayload(user.birthday),
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
      const text = normalizeCommentText(args.input.text);
      if (!text) throw new Error('El comentario no puede estar vacío.');
      if (text.length > MAX_COMMENT_LENGTH) {
        throw new Error(
          `El comentario no puede superar ${MAX_COMMENT_LENGTH} caracteres.`
        );
      }

      const tortilla = await Tortilla.findById(args.input.tortillaId)
        .select('_id')
        .exec();
      if (!tortilla) throw new Error('Tortilla no encontrada.');

      const viewer = sessionUser(ctx.session);
      if (!viewer) throw new Error('Debes iniciar sesión para comentar.');

      const doc = await Comment.create({
        tortilla: tortilla._id,
        user: viewer.id,
        userKey: viewer.key,
        userName: viewer.name,
        text,
      });

      // Resolvemos la imagen del autor para mantener simetría con el resolver.
      const userDoc = await User.findById(viewer.id)
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
      const viewer = sessionUser(ctx.session);
      const doc = await Comment.findById(args.id).exec();
      if (!doc) throw new Error('Comentario no encontrado.');
      const isMine = viewer
        ? doc.user
          ? doc.user.equals(viewer.id)
          : doc.userKey === viewer.key
        : false;
      if (!isMine) {
        throw new Error('Sólo puedes borrar tus propios comentarios.');
      }
      await doc.deleteOne();
      return true;
    },

    async announceTortilla(
      _: unknown,
      args: {
        input: {
          date?: string | Date | null;
          note?: string | null;
          capacity?: number | null;
        };
      },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);
      const capacity = validateCapacity(args.input.capacity);

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
        capacity,
        attendees: [],
        requests: [],
        announcedByKey: ctx.session!.user.usernameKey,
      });

      return eventPayload(doc, sessionUser(ctx.session));
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
      return eventPayload(doc, sessionUser(ctx.session));
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
      const viewer = sessionUser(ctx.session);
      if (!viewer) throw new Error('Debes iniciar sesión para apuntarte.');

      // Apuntarse con la convocatoria llena deja una solicitud en cola;
      // desapuntarse (o retirar la solicitud) deja entrar a la siguiente.
      const doc = await updateEventSpots(args.id, (state) => {
        const now = new Date();
        if (args.attending) {
          joinSpots(
            state,
            { user: viewer.id.toString(), userKey: viewer.key, userName: viewer.name },
            now
          );
        } else {
          leaveSpots(state, viewer.id.toString(), now);
        }
      });
      return eventPayload(doc, viewer);
    },

    async reviewSpotRequest(
      _: unknown,
      args: { eventId: string; userId: string; approve: boolean },
      ctx: GqlContext
    ) {
      await connectToDatabase();
      await requireAdmin(ctx);
      if (
        !Types.ObjectId.isValid(args.eventId) ||
        !Types.ObjectId.isValid(args.userId)
      ) {
        throw new Error('ID inválido.');
      }
      const doc = await updateEventSpots(args.eventId, (state) => {
        reviewSpots(state, args.userId, args.approve, new Date());
      });
      return eventPayload(doc, sessionUser(ctx.session));
    },
  },

  Tortilla: {
    async votes(parent: ResolvedTortilla) {
      await connectToDatabase();
      const docs = await Vote.find({ tortilla: parent._id })
        .sort({ createdAt: -1 })
        .exec();
      const imageById = await imagesByUserId(docs.map((v) => v.user));
      return docs.map((v: VoteDocument) => ({
        id: (v._id as Types.ObjectId).toString(),
        userName: v.userName,
        score: v.score,
        reaction: v.reaction ?? null,
        createdAt: v.createdAt,
        imageUrl: v.user ? (imageById.get(v.user.toString()) ?? null) : null,
      }));
    },

    async myVote(parent: ResolvedTortilla) {
      const userId = parent._ctxUserId;
      if (!userId) return null;
      await connectToDatabase();
      const v = await Vote.findOne({
        tortilla: parent._id,
        user: userId,
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
      const imageById = await imagesByUserId(docs.map((c) => c.user));
      const myId = parent._ctxUserId;
      return docs.map((c: CommentDocument) => ({
        id: (c._id as Types.ObjectId).toString(),
        userName: c.userName,
        text: c.text,
        createdAt: c.createdAt,
        imageUrl: c.user ? (imageById.get(c.user.toString()) ?? null) : null,
        isMine: Boolean(myId && c.user?.equals(myId)),
      }));
    },
  },

  User: {
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
  },
};
