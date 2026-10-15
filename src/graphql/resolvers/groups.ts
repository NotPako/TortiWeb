import { Types } from 'mongoose';
import { randomInt } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { Group, type GroupDocument } from '@/models/Group';
import { Membership } from '@/models/Membership';
import { GroupInvite, type GroupInviteDocument } from '@/models/GroupInvite';
import { TortillaEvent } from '@/models/TortillaEvent';
import { User, userImageUrl } from '@/models/User';
import {
  isGroupRole,
  leavesGroupWithoutAdmin,
  normalizeGroupDescription,
  normalizeGroupName,
  pickAvailableSlug,
  slugify,
  type GroupRole,
} from '@/lib/groups';
import {
  generateInviteCode,
  inviteStatus,
  normalizeInviteCode,
  normalizeInviteLimits,
} from '@/lib/invites';
import { leave as leaveSpots } from '@/lib/eventSpots';
import { isDuplicateKeyError, requireUser, sessionUser, type GqlContext } from './context';
import {
  findGroupAccess,
  requireGroupAccess,
  requireGroupAdmin,
  type GroupAccess,
} from './access';
import {
  groupPayload,
  idOf,
  invitePayload,
  memberPayload,
  type ResolvedGroup,
} from './payloads';
import { updateEventSpots } from './spots';

const INVITE_NOT_FOUND = 'Invitación no válida.';
const MEMBER_NOT_FOUND = 'Miembro no encontrado.';
const LAST_ADMIN = 'El grupo se quedaría sin admins. Nombra a otro admin antes.';

const INVITE_ERRORS: Record<'revoked' | 'expired' | 'exhausted', string> = {
  revoked: 'Esta invitación ya no es válida.',
  expired: 'Esta invitación ha caducado.',
  exhausted: 'Esta invitación ya se ha usado el máximo de veces.',
};

async function findInviteByCode(code: string): Promise<GroupInviteDocument | null> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return null;
  return GroupInvite.findOne({ code: normalized }).exec();
}

async function membersRoles(groupId: Types.ObjectId) {
  const docs = await Membership.find({ group: groupId }).select('user role').exec();
  return docs.map((m) => ({ user: m.user.toString(), role: m.role }));
}

/**
 * Quien sale del grupo deja de estar apuntado a su convocatoria abierta (y
 * de su cola): si no, el admin seguiría viendo sus alergias y contándolo para
 * cocinar. Si libera plaza, entra la siguiente solicitud.
 */
async function removeFromOpenEvents(groupId: Types.ObjectId, userId: Types.ObjectId) {
  const open = await TortillaEvent.find({ group: groupId, closedAt: null })
    .select('_id')
    .exec();
  for (const event of open) {
    await updateEventSpots(event._id as Types.ObjectId, (state) =>
      leaveSpots(state, userId.toString(), new Date())
    );
  }
}

/** Crea el grupo con el primer slug libre, reintentando si otro se adelanta. */
async function createGroupWithFreeSlug(
  name: string,
  description: string | null,
  createdBy: Types.ObjectId
): Promise<GroupDocument> {
  // `slugify` solo produce [a-z0-9-], así que es seguro meterlo en la regex.
  const base = slugify(name);
  for (let attempt = 0; ; attempt++) {
    const existing = await Group.find({ slug: { $regex: `^${base}(-\\d+)?$` } })
      .select('slug')
      .exec();
    const slug = pickAvailableSlug(base, new Set(existing.map((g) => g.slug)));
    try {
      return await Group.create({
        name,
        slug,
        description: description ?? undefined,
        createdBy,
      });
    } catch (err) {
      if (!isDuplicateKeyError(err) || attempt >= 2) throw err;
    }
  }
}

async function createUniqueInvite(
  access: GroupAccess,
  limits: { expiresAt: Date | null; maxUses: number | null }
): Promise<GroupInviteDocument> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await GroupInvite.create({
        group: access.group._id,
        code: generateInviteCode(randomInt),
        createdBy: access.user.id,
        ...limits,
      });
    } catch (err) {
      if (!isDuplicateKeyError(err) || attempt >= 4) throw err;
    }
  }
}

/** Miembro del grupo por id de cuenta, o error. */
async function findMemberOrThrow(groupId: Types.ObjectId, userId: string) {
  if (!Types.ObjectId.isValid(userId)) throw new Error(MEMBER_NOT_FOUND);
  const target = await Membership.findOne({ group: groupId, user: userId }).exec();
  if (!target) throw new Error(MEMBER_NOT_FOUND);
  return target;
}

export const groupQueries = {
  async myGroups(_: unknown, __: unknown, ctx: GqlContext) {
    const user = sessionUser(ctx.session);
    if (!user) return [];
    await connectToDatabase();
    const memberships = await Membership.find({ user: user.id }).exec();
    if (memberships.length === 0) return [];
    const groups = await Group.find({
      _id: { $in: memberships.map((m) => m.group) },
    }).exec();
    const byId = new Map(groups.map((g) => [idOf(g), g]));
    return memberships
      .flatMap((m) => {
        const group = byId.get(m.group.toString());
        return group ? [groupPayload(group, m)] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  /** Detalle del grupo, o `null` si no existe o no eres miembro. */
  async group(_: unknown, args: { slug: string }, ctx: GqlContext) {
    await connectToDatabase();
    const access = await findGroupAccess(ctx, { slug: args.slug });
    return access ? groupPayload(access.group, access.membership) : null;
  },

  /**
   * Lo que ve quien abre un enlace de invitación antes de aceptarlo. Tener el
   * código basta para ver el nombre del grupo: es lo que se le ha enviado.
   */
  async invitePreview(_: unknown, args: { code: string }, ctx: GqlContext) {
    const user = requireUser(ctx);
    await connectToDatabase();
    const invite = await findInviteByCode(args.code);
    if (!invite) return null;
    const group = await Group.findById(invite.group).exec();
    if (!group) return null;
    const alreadyMember = await Membership.exists({ group: group._id, user: user.id });
    return {
      groupName: group.name,
      groupSlug: group.slug,
      status: inviteStatus(invite, new Date()),
      alreadyMember: Boolean(alreadyMember),
    };
  },
};

export const groupMutations = {
  /** Cualquier usuario puede crear un grupo; queda como su primer admin. */
  async createGroup(
    _: unknown,
    args: { input: { name: string; description?: string | null } },
    ctx: GqlContext
  ) {
    const user = requireUser(ctx);
    await connectToDatabase();
    const name = normalizeGroupName(args.input.name);
    const description = normalizeGroupDescription(args.input.description);

    const group = await createGroupWithFreeSlug(name, description, user.id);
    try {
      const membership = await Membership.create({
        group: group._id,
        user: user.id,
        userName: user.name,
        role: 'admin',
        // Grupo nuevo: no hay logros previos que no celebrar.
        seenAchievements: [],
      });
      return groupPayload(group, membership);
    } catch (err) {
      // Un grupo sin su admin sería inaccesible para siempre.
      await group.deleteOne();
      throw err;
    }
  },

  async createInvite(
    _: unknown,
    args: {
      input: { groupSlug: string; expiresInDays?: number | null; maxUses?: number | null };
    },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAdmin(ctx, { slug: args.input.groupSlug });
    const now = new Date();
    const limits = normalizeInviteLimits(args.input, now);
    const invite = await createUniqueInvite(access, limits);
    return invitePayload(invite, now);
  },

  async revokeInvite(_: unknown, args: { id: string }, ctx: GqlContext) {
    await connectToDatabase();
    requireUser(ctx);
    if (!Types.ObjectId.isValid(args.id)) throw new Error(INVITE_NOT_FOUND);
    const invite = await GroupInvite.findById(args.id).exec();
    if (!invite) throw new Error(INVITE_NOT_FOUND);
    await requireGroupAdmin(ctx, { id: invite.group }, INVITE_NOT_FOUND);
    if (!invite.revokedAt) {
      invite.revokedAt = new Date();
      await invite.save();
    }
    return invitePayload(invite, new Date());
  },

  /** Idempotente: si ya eres miembro, devuelve el grupo sin gastar un uso. */
  async redeemInvite(_: unknown, args: { code: string }, ctx: GqlContext) {
    const user = requireUser(ctx, 'Inicia sesión para unirte al grupo.');
    await connectToDatabase();
    const invite = await findInviteByCode(args.code);
    if (!invite) throw new Error(INVITE_NOT_FOUND);
    const group = await Group.findById(invite.group).exec();
    if (!group) throw new Error(INVITE_NOT_FOUND);

    const existing = await Membership.findOne({ group: group._id, user: user.id }).exec();
    if (existing) return groupPayload(group, existing);

    const now = new Date();
    const status = inviteStatus(invite, now);
    if (status !== 'active') throw new Error(INVITE_ERRORS[status]);

    // Consumir el uso de forma atómica: dos canjes simultáneos del último uso
    // no pueden pasar los dos.
    const consumed = await GroupInvite.findOneAndUpdate(
      {
        _id: invite._id,
        revokedAt: null,
        $and: [
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          { $or: [{ maxUses: null }, { $expr: { $lt: ['$uses', '$maxUses'] } }] },
        ],
      },
      { $inc: { uses: 1 } },
      { new: true }
    ).exec();
    if (!consumed) throw new Error(INVITE_ERRORS.exhausted);

    try {
      // Sin `seenAchievements`: si ya votó en este grupo antes de tener cuenta
      // (votos históricos), la primera visita fija la línea base sin celebrar.
      const membership = await Membership.create({
        group: group._id,
        user: user.id,
        userName: user.name,
        role: 'member',
      });
      return groupPayload(group, membership);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Otra petición suya entró a la vez: ya es miembro, devolvemos el grupo.
      await GroupInvite.updateOne({ _id: invite._id }, { $inc: { uses: -1 } });
      const membership = await Membership.findOne({ group: group._id, user: user.id }).exec();
      if (!membership) throw err;
      return groupPayload(group, membership);
    }
  },

  async setMemberRole(
    _: unknown,
    args: { groupSlug: string; userId: string; role: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAdmin(ctx, { slug: args.groupSlug });
    if (!isGroupRole(args.role)) throw new Error('Rol no válido.');
    const role: GroupRole = args.role;
    const groupId = access.group._id as Types.ObjectId;

    const target = await findMemberOrThrow(groupId, args.userId);
    if (
      leavesGroupWithoutAdmin(await membersRoles(groupId), {
        user: target.user.toString(),
        role,
      })
    ) {
      throw new Error(LAST_ADMIN);
    }

    if (target.role !== role) {
      target.role = role;
      await target.save();
    }
    const userDoc = await User.findById(target.user).select('image imageKey').exec();
    return memberPayload(target, userDoc ? userImageUrl(userDoc) : null, access.user.id);
  },

  async removeMember(
    _: unknown,
    args: { groupSlug: string; userId: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAdmin(ctx, { slug: args.groupSlug });
    const groupId = access.group._id as Types.ObjectId;
    if (args.userId === access.user.id.toString()) {
      throw new Error('Para irte del grupo usa "Salir del grupo".');
    }

    const target = await findMemberOrThrow(groupId, args.userId);
    if (
      leavesGroupWithoutAdmin(await membersRoles(groupId), {
        user: target.user.toString(),
        role: null,
      })
    ) {
      throw new Error(LAST_ADMIN);
    }

    // Sus votos y comentarios se conservan, igual que los votos históricos de
    // gente sin cuenta: forman parte de las medias del grupo.
    await target.deleteOne();
    await removeFromOpenEvents(groupId, target.user);
    return true;
  },

  async leaveGroup(_: unknown, args: { groupSlug: string }, ctx: GqlContext) {
    await connectToDatabase();
    const access = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const groupId = access.group._id as Types.ObjectId;
    if (
      leavesGroupWithoutAdmin(await membersRoles(groupId), {
        user: access.user.id.toString(),
        role: null,
      })
    ) {
      throw new Error(LAST_ADMIN);
    }
    await access.membership.deleteOne();
    await removeFromOpenEvents(groupId, access.user.id);
    return true;
  },
};

/**
 * Campos de `Group`. El padre sale de `group`/`myGroups`/`createGroup`/
 * `redeemInvite`, que ya garantizan que quien pregunta es miembro.
 */
export const groupFields = {
  async memberCount(parent: ResolvedGroup) {
    await connectToDatabase();
    return Membership.countDocuments({ group: parent._id }).exec();
  },

  async members(parent: ResolvedGroup) {
    await connectToDatabase();
    const memberships = await Membership.find({ group: parent._id })
      .sort({ joinedAt: 1 })
      .exec();
    const users = memberships.length
      ? await User.find({ _id: { $in: memberships.map((m) => m.user) } })
          .select('image imageKey')
          .exec()
      : [];
    const imageById = new Map(users.map((u) => [idOf(u), userImageUrl(u)]));
    return memberships.map((m) =>
      memberPayload(m, imageById.get(m.user.toString()) ?? null, parent._viewerId)
    );
  },

  /** Solo para admins del grupo; `null` para el resto. */
  async invites(parent: ResolvedGroup) {
    if (!parent.isAdmin) return null;
    await connectToDatabase();
    const docs = await GroupInvite.find({ group: parent._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    const now = new Date();
    return docs.map((d) => invitePayload(d, now));
  },
};
