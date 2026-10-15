import { Types } from 'mongoose';
import { Tortilla, type TortillaDocument } from '@/models/Tortilla';
import { Vote, type Reaction } from '@/models/Vote';
import { Comment } from '@/models/Comment';
import { TortillaEvent } from '@/models/TortillaEvent';
import { User, userImageUrl } from '@/models/User';
import { computeAchievements, visibleAchievements } from '@/lib/achievements';
import { isSameDay } from '@/lib/dates';
import { computeStreaks } from '@/lib/streak';
import { buildImageUrl } from './media';
import { idOf } from './payloads';

/**
 * A quién se le calculan las estadísticas, siempre dentro de un grupo. Con
 * cuenta se busca por id, así que renombrarse no pierde el historial; sin
 * cuenta (votos históricos anteriores al registro) solo queda el nombre.
 */
export type StatsTarget = {
  groupId: Types.ObjectId;
  userId: Types.ObjectId | null;
  userKey: string;
};

/** Filtro de lo propio (votos, comentarios) dentro del grupo. */
function ownFilter(t: StatsTarget) {
  return t.userId
    ? { group: t.groupId, user: t.userId }
    : { group: t.groupId, userKey: t.userKey, user: { $exists: false } };
}

/**
 * Reúne lo que necesitan los logros: los votos y comentarios de los demás en
 * las mismas tortillas (para "el más duro", "Oráculo", "Madrugador"…), qué
 * tortillas ya cerraron y a cuántas convocatorias se apuntó. Todo del grupo.
 */
async function achievementsFor(args: {
  target: StatsTarget;
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
  const { target, tortillaList } = args;
  const voteDocs = args.voteDocs.filter(
    (v): v is typeof v & { tortilla: TortillaDocument } => Boolean(v.tortilla)
  );
  const myVoteIds = new Set(voteDocs.map((v) => String(v._id)));
  const userTortillaIds = voteDocs.map((v) => v.tortilla._id as Types.ObjectId);

  const myComments = await Comment.find(ownFilter(target))
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
      target.userId
        ? { group: target.groupId, 'attendees.user': target.userId }
        : {
            group: target.groupId,
            attendees: { $elemMatch: { userKey: target.userKey, user: { $exists: false } } },
          }
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

/**
 * Estadísticas de una persona en un grupo: votos, media, rachas, mejor
 * tortilla y logros. Los logros ocultos bloqueados no se incluyen.
 */
export async function computeUserStats(target: StatsTarget) {
  const voteDocs = await Vote.find(ownFilter(target))
    .sort({ createdAt: -1 })
    .populate<{ tortilla: TortillaDocument }>('tortilla')
    .exec();

  // Nombre: el de la cuenta; sin cuenta, el del voto más reciente.
  let username = target.userKey;
  let imageUrl: string | null = null;
  const userDoc = target.userId
    ? await User.findById(target.userId).select('username image imageKey').exec()
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
      ? Number((voteDocs.reduce((s, v) => s + v.score, 0) / totalVotes).toFixed(2))
      : null;

  const votes = voteDocs
    .filter((v) => v.tortilla)
    .map((v) => ({
      id: idOf(v),
      score: v.score,
      reaction: v.reaction ?? null,
      createdAt: v.createdAt,
      tortilla: {
        id: idOf(v.tortilla),
        name: v.tortilla.name,
        date: v.tortilla.date,
        imageUrl: buildImageUrl(v.tortilla),
      },
    }));

  const bestVote =
    votes.length > 0 ? [...votes].sort((a, b) => b.score - a.score)[0] : null;

  const tortillaList = await Tortilla.find({ group: target.groupId })
    .sort({ date: -1 })
    .select('_id date closedAt')
    .exec();

  // La racha se cuenta por día, no por tortilla: si un día hubo dos, haber
  // votado cualquiera de ellas mantiene la racha.
  const { currentStreak, bestStreak } = computeStreaks({
    tortillas: tortillaList.map((d) => ({ id: idOf(d), date: d.date })),
    votedTortillaIds: new Set(votes.map((v) => v.tortilla.id)),
  });

  const allAchievements = await achievementsFor({
    target,
    voteDocs,
    tortillaList,
    totalVotes,
    bestStreak,
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
    // Los ocultos no se mandan hasta desbloquearlos: ni siquiera su existencia.
    achievements: visibleAchievements(allAchievements),
  };
}
