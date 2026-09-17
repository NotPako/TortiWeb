import { Types } from 'mongoose';
import { Tortilla, type TortillaDocument } from '@/models/Tortilla';
import { Vote } from '@/models/Vote';
import { User, userImageUrl } from '@/models/User';
import {
  computeAchievements,
  type VoteForAchievements,
} from '@/lib/achievements';
import { computeStreaks } from '@/lib/streak';
import { buildImageUrl } from './media';

/**
 * Estadísticas de un usuario **dentro de un grupo**: votos, racha y logros
 * solo cuentan tortillas de ese grupo. Quien llama ya ha comprobado el acceso.
 */
export async function computeUserStats(
  userKey: string,
  groupId: Types.ObjectId
) {
  const voteDocs = await Vote.find({ userKey, group: groupId })
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

  const tortillaList = await Tortilla.find({ group: groupId })
    .sort({ date: -1 })
    .select('_id date')
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

  // Logros: necesitamos min/max por tortilla en las que votó el usuario. Las
  // tortillas ya son todas del grupo, así que no hace falta filtrar más.
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
