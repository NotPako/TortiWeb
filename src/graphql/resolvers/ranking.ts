import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla } from '@/models/Tortilla';
import { Vote } from '@/models/Vote';
import { User, userImageUrl } from '@/models/User';
import {
  MIN_VOTES_PER_TORTILLA,
  MIN_VOTES_PER_VOTER,
  computeRanking,
  type RankedVoter,
} from '@/lib/ranking';
import type { GqlContext } from './context';
import { requireGroupAccess } from './access';
import { buildImageUrl } from './media';
import { idOf } from './payloads';

export const rankingQueries = {
  /** Podios del grupo: mejores tortillas del año, más duro, más generoso… */
  async ranking(_: unknown, args: { groupSlug: string }, ctx: GqlContext) {
    await connectToDatabase();
    const { group } = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const [tortillaDocs, voteDocs] = await Promise.all([
      Tortilla.find({ group: group._id }).sort({ date: -1 }).exec(),
      Vote.find({ group: group._id })
        .select('tortilla user userKey userName score')
        .lean()
        .exec(),
    ]);

    // Una persona es su cuenta; los votos históricos sin cuenta, su nombre.
    const voterKeyOf = (v: (typeof voteDocs)[number]) =>
      v.user ? `id:${v.user.toString()}` : `name:${v.userKey}`;
    const ranking = computeRanking({
      tortillas: tortillaDocs.map((d) => ({ id: idOf(d), date: d.date })),
      votes: voteDocs.map((v) => ({
        tortillaId: v.tortilla.toString(),
        voterKey: voterKeyOf(v),
        score: v.score,
      })),
    });

    const podiums = [ranking.toughest, ranking.generous, ranking.streaks, ranking.mostVotes];
    const userIds = [
      ...new Set(
        podiums
          .flat()
          .filter((r) => r.voterKey.startsWith('id:'))
          .map((r) => r.voterKey.slice(3))
      ),
    ];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('username image imageKey').exec()
      : [];
    const userById = new Map(users.map((u) => [idOf(u), u]));
    const nameByKey = new Map(voteDocs.map((v) => [voterKeyOf(v), v.userName]));
    const voterPayload = (r: RankedVoter) => {
      const user = r.voterKey.startsWith('id:') ? userById.get(r.voterKey.slice(3)) : undefined;
      return {
        userName: user?.username ?? nameByKey.get(r.voterKey) ?? '?',
        imageUrl: user ? userImageUrl(user) : null,
        value: r.value,
        voteCount: r.voteCount,
      };
    };

    const tortillaById = new Map(tortillaDocs.map((d) => [idOf(d), d]));
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
};
