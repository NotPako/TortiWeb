import { Types } from 'mongoose';
import { randomInt } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { Group, type GroupDocument } from '@/models/Group';
import { Membership } from '@/models/Membership';
import { GroupInvite, type GroupInviteDocument } from '@/models/GroupInvite';
import { TortillaEvent } from '@/models/TortillaEvent';
import { User, normalizeUsername, userImageUrl } from '@/models/User';
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
import {
  isDuplicateKeyError,
  requireUser,
  sessionUser,
  type GqlContext,
} from './context';
import {
  findGroupAccess,
  requireGroupAccess,
  requireGroupAdmin,
  type GroupAccess,
} from './access';
import {
  groupPayload,
  invitePayload,
  memberPayload,
  type ResolvedGroup,
} from './payloads';

const INVITE_NOT_FOUND = 'Invitación no válida.';
const MEMBER_NOT_FOUND = 'Miembro no encontrado.';
const LAST_ADMIN =
  'El grupo se quedaría sin admins. Nombra a otro admin antes.';

const INVITE_ERRORS: Record<'revoked' | 'expired' | 'exhausted', string> = {
  revoked: 'Esta invitación ya no es válida.',
  expired: 'Esta invitación ha caducado.',
  exhausted: 'Esta invitación ya se ha usado el máximo de veces.',
};

async function findInviteByCode(
  code: string
): Promise<GroupInviteDocument | null> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return null;
  return GroupInvite.findOne({ code: normalized }).exec();
}

async function membersRoles(groupId: Types.ObjectId) {
  const docs = await Membership.find({ group: groupId })
    .select('userKey role')
    .exec();
  return docs.map((m) => ({ userKey: m.userKey, role: m.role }));
}

/**
 * Quien sale del grupo deja de estar apuntado a su convocatoria abierta: si no,
 * el admin seguiría viendo sus alergias y contándolo para cocinar.
 */
async function removeFromOpenEvents(groupId: Types.ObjectId, userKey: string) {
  await TortillaEvent.updateMany(
    { group: groupId, closedAt: null },
    { $pull: { attendees: { userKey } } }
  ).exec();
}

/** Crea el grupo con el primer slug libre, reintentando si otro se adelanta. */
async function createGroupWithFreeSlug(
  name: string,
  description: string | null,
  createdByKey: string
): Promise<GroupDocument> {
  // `slugify` solo produce [a-z0-9-], así que es seguro meterlo en la regex.
  const base = slugify(name);
  for (let attempt = 0; ; attempt++) {
    const existing = await Group.find({
      slug: { $regex: `^${base}(-\\d+)?$` },
    })
      .select('slug')
      .exec();
    const slug = pickAvailableSlug(base, new Set(existing.map((g) => g.slug)));
    try {
      return await Group.create({
        name,
        slug,
        description: description ?? undefined,
        createdByKey,
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
        createdByKey: access.user.userKey,
        ...limits,
      });
    } catch (err) {
      if (!isDuplicateKeyError(err) || attempt >= 4) throw err;
    }
  }
}

export const groupQueries = {
  async myGroups(_: unknown, __: unknown, ctx: GqlContext) {
    const user = sessionUser(ctx);
    if (!user) return [];
    await connectToDatabase();
    const memberships = await Membership.find({ userKey: user.userKey }).exec();
    if (memberships.length === 0) return [];
    const groups = await Group.find({
      _id: { $in: memberships.map((m) => m.group) },
    }).exec();
    const byId = new Map(groups.map((g) => [String(g._id), g]));
    return memberships
      .flatMap((m) => {
        const group = byId.get(String(m.group));
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
    const alreadyMember = await Membership.exists({
      group: group._id,
      userKey: user.userKey,
    });
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

    const group = await createGroupWithFreeSlug(name, description, user.userKey);
    try {
      const membership = await Membership.create({
        group: group._id,
        userKey: user.userKey,
        userName: user.userName,
        role: 'admin',
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
      input: {
        groupSlug: string;
        expiresInDays?: number | null;
        maxUses?: number | null;
      };
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

    const existing = await Membership.findOne({
      group: group._id,
      userKey: user.userKey,
    }).exec();
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
          {
            $or: [
              { maxUses: null },
              { $expr: { $lt: ['$uses', '$maxUses'] } },
            ],
          },
        ],
      },
      { $inc: { uses: 1 } },
      { new: true }
    ).exec();
    if (!consumed) throw new Error(INVITE_ERRORS.exhausted);

    try {
      const membership = await Membership.create({
        group: group._id,
        userKey: user.userKey,
        userName: user.userName,
        role: 'member',
      });
      return groupPayload(group, membership);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Otra petición suya entró a la vez: ya es miembro, devolvemos el grupo.
      await GroupInvite.updateOne({ _id: invite._id }, { $inc: { uses: -1 } });
      const membership = await Membership.findOne({
        group: group._id,
        userKey: user.userKey,
      }).exec();
      if (!membership) throw err;
      return groupPayload(group, membership);
    }
  },

  async setMemberRole(
    _: unknown,
    args: { groupSlug: string; userName: string; role: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAdmin(ctx, { slug: args.groupSlug });
    if (!isGroupRole(args.role)) throw new Error('Rol no válido.');
    const role: GroupRole = args.role;
    const groupId = access.group._id as Types.ObjectId;

    const target = await Membership.findOne({
      group: groupId,
      userKey: normalizeUsername(args.userName),
    }).exec();
    if (!target) throw new Error(MEMBER_NOT_FOUND);

    if (
      leavesGroupWithoutAdmin(await membersRoles(groupId), {
        userKey: target.userKey,
        role,
      })
    ) {
      throw new Error(LAST_ADMIN);
    }

    if (target.role !== role) {
      target.role = role;
      await target.save();
    }
    const userDoc = await User.findOne({ usernameKey: target.userKey })
      .select('image imageKey')
      .exec();
    return memberPayload(
      target,
      userDoc ? userImageUrl(userDoc) : null,
      access.user.userKey
    );
  },

  async removeMember(
    _: unknown,
    args: { groupSlug: string; userName: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAdmin(ctx, { slug: args.groupSlug });
    const groupId = access.group._id as Types.ObjectId;
    const userKey = normalizeUsername(args.userName);
    if (userKey === access.user.userKey) {
      throw new Error('Para irte del grupo usa "Salir del grupo".');
    }

    const target = await Membership.findOne({ group: groupId, userKey }).exec();
    if (!target) throw new Error(MEMBER_NOT_FOUND);
    if (
      leavesGroupWithoutAdmin(await membersRoles(groupId), {
        userKey,
        role: null,
      })
    ) {
      throw new Error(LAST_ADMIN);
    }

    // Sus votos y comentarios se conservan, igual que los votos históricos de
    // gente sin cuenta: forman parte de las medias del grupo.
    await target.deleteOne();
    await removeFromOpenEvents(groupId, userKey);
    return true;
  },

  async leaveGroup(_: unknown, args: { groupSlug: string }, ctx: GqlContext) {
    await connectToDatabase();
    const access = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const groupId = access.group._id as Types.ObjectId;
    const { userKey } = access.user;
    if (
      leavesGroupWithoutAdmin(await membersRoles(groupId), {
        userKey,
        role: null,
      })
    ) {
      throw new Error(LAST_ADMIN);
    }
    await access.membership.deleteOne();
    await removeFromOpenEvents(groupId, userKey);
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
    const keys = memberships.map((m) => m.userKey);
    const users = keys.length
      ? await User.find({ usernameKey: { $in: keys } })
          .select('usernameKey image imageKey')
          .exec()
      : [];
    const imageByKey = new Map(
      users.map((u) => [u.usernameKey, userImageUrl(u)])
    );
    return memberships.map((m) =>
      memberPayload(m, imageByKey.get(m.userKey) ?? null, parent._viewerKey)
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
