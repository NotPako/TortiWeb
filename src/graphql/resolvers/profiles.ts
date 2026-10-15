import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Membership } from '@/models/Membership';
import { Vote } from '@/models/Vote';
import { User, normalizeUsername } from '@/models/User';
import { isAchievementId, unseenAchievements } from '@/lib/achievements';
import { sessionUser, type GqlContext } from './context';
import { findGroupAccess, requireGroupAccess } from './access';
import { computeUserStats } from './stats';

/**
 * Perfiles y logros, siempre dentro de un grupo: las estadísticas de alguien
 * solo cuentan lo que hizo en ese grupo, y solo las ven sus miembros. Así no
 * se revela en qué otras peñas está nadie.
 */
export const profileQueries = {
  async myStats(_: unknown, args: { groupSlug: string }, ctx: GqlContext) {
    if (!sessionUser(ctx.session)) return null;
    await connectToDatabase();
    // De un grupo ajeno, como si no existiera.
    const access = await requireGroupAccess(ctx, { slug: args.groupSlug });
    return computeUserStats({
      groupId: access.group._id as Types.ObjectId,
      userId: access.user.id,
      userKey: access.user.key,
    });
  },

  /**
   * Estadísticas de alguien en el grupo, o null si nunca ha sido miembro ni
   * ha votado en él (los votantes históricos sin cuenta solo tienen votos).
   */
  async userStats(
    _: unknown,
    args: { groupSlug: string; username: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const { group } = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const groupId = group._id as Types.ObjectId;
    const usernameKey = normalizeUsername(args.username);
    if (!usernameKey) return null;

    const userDoc = await User.findOne({ usernameKey }).select('_id').exec();
    const userId = (userDoc?._id as Types.ObjectId | undefined) ?? null;
    const belongs = userId
      ? (await Membership.exists({ group: groupId, user: userId })) ||
        (await Vote.exists({ group: groupId, user: userId }))
      : await Vote.exists({ group: groupId, userKey: usernameKey, user: { $exists: false } });
    if (!belongs) return null;

    return computeUserStats({ groupId, userId, userKey: usernameKey });
  },

  /**
   * Logros desbloqueados en el grupo cuyo aviso aún no se ha mostrado. La
   * primera vez fija la línea base y devuelve vacío, para no celebrar los que
   * ya tenía.
   */
  async newAchievements(_: unknown, args: { groupSlug: string }, ctx: GqlContext) {
    if (!sessionUser(ctx.session)) return [];
    await connectToDatabase();
    const access = await findGroupAccess(ctx, { slug: args.groupSlug });
    if (!access) return [];
    const { achievements } = await computeUserStats({
      groupId: access.group._id as Types.ObjectId,
      userId: access.user.id,
      userKey: access.user.key,
    });
    const seen = access.membership.seenAchievements;
    if (!seen) {
      // Primera vez: lo que ya tenía no es "nuevo".
      await Membership.updateOne(
        { _id: access.membership._id, seenAchievements: { $exists: false } },
        {
          $set: {
            seenAchievements: achievements.filter((a) => a.unlocked).map((a) => a.id),
          },
        }
      ).exec();
      return [];
    }
    return unseenAchievements(achievements, seen);
  },
};

export const profileMutations = {
  /** Marca como vistos los avisos de esos logros en el grupo. */
  async markAchievementsSeen(
    _: unknown,
    args: { groupSlug: string; ids: string[] },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const ids = [...new Set(args.ids)].filter(isAchievementId);
    if (ids.length === 0) return true;
    await Membership.updateOne(
      { _id: access.membership._id },
      { $addToSet: { seenAchievements: { $each: ids } } }
    ).exec();
    return true;
  },
};
