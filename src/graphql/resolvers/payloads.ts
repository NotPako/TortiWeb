import { Types } from 'mongoose';
import { Vote } from '@/models/Vote';
import { User, userImageUrl } from '@/models/User';
import type { TortillaDocument } from '@/models/Tortilla';
import type { TortillaEventDocument } from '@/models/TortillaEvent';
import type { GroupDocument } from '@/models/Group';
import type { MembershipDocument } from '@/models/Membership';
import type { GroupInviteDocument } from '@/models/GroupInvite';
import { inviteStatus } from '@/lib/invites';
import type { Birthday } from '@/lib/birthday';
import { pendingRequests, requestStatusFor } from '@/lib/eventSpots';
import { buildImageUrl } from './media';
import type { CtxUser } from './context';
import { spotsStateOf } from './spots';

export function idOf(doc: { _id: unknown }): string {
  return (doc._id as Types.ObjectId).toString();
}

/** El subdocumento de Mongoose lleva más cosas: devolvemos solo día y mes. */
export function birthdayPayload(b: Birthday | null | undefined): Birthday | null {
  return b ? { day: b.day, month: b.month } : null;
}

/** Avatares por id de usuario, en una sola consulta. */
export async function imagesByUserId(
  ids: (Types.ObjectId | undefined)[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(
    new Map(
      ids
        .filter((id): id is Types.ObjectId => Boolean(id))
        .map((id) => [id.toString(), id])
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

export async function tortillaPayload(
  doc: TortillaDocument,
  viewer: CtxUser | null
) {
  const { averageScore, voteCount } = await computeStats(
    doc._id as Types.ObjectId
  );
  const closedAt = doc.closedAt ?? null;
  // La votación está abierta mientras la tortilla sea de la jornada en curso
  // de su grupo y no se haya cerrado a mano. Lo primero se aplica en
  // `currentTortillas` y `castVote`; aquí solo el cierre del admin.
  const votingOpen = !closedAt;
  return {
    id: idOf(doc),
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

export type ResolvedTortilla = Awaited<ReturnType<typeof tortillaPayload>>;

/**
 * Convocatoria vista por `viewer`. `viewerIsAdmin` es su rol en el grupo de la
 * convocatoria, que el resolver ya leyó al comprobar el acceso.
 */
export async function eventPayload(
  doc: TortillaEventDocument,
  viewer: CtxUser | null,
  viewerIsAdmin: boolean
) {
  const ids = [...doc.attendees, ...doc.requests]
    .map((a) => a.user)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const users = ids.length
    ? await User.find({ _id: { $in: ids } })
        .select('image imageKey allergens allergyNotes')
        .exec()
    : [];
  const userById = new Map(users.map((u) => [idOf(u), u]));

  const isAttending = viewer
    ? doc.attendees.some((a) => a.user?.equals(viewer.id))
    : false;
  // Las alergias son datos de salud: solo las ven los admins del grupo y
  // quienes están apuntados a esta misma convocatoria. Para el resto van a
  // null, que NO significa "sin alergias".
  const canSeeAllergies = isAttending || viewerIsAdmin;

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
    id: idOf(doc),
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
    pendingRequests: viewerIsAdmin
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

export function groupPayload(
  group: GroupDocument,
  membership: MembershipDocument
) {
  return {
    id: idOf(group),
    name: group.name,
    slug: group.slug,
    description: group.description ?? null,
    myRole: membership.role,
    isAdmin: membership.role === 'admin',
    _id: group._id as Types.ObjectId,
    _viewerId: membership.user,
  };
}

export type ResolvedGroup = ReturnType<typeof groupPayload>;

export function memberPayload(
  membership: MembershipDocument,
  imageUrl: string | null,
  viewerId: Types.ObjectId
) {
  return {
    userId: membership.user.toString(),
    userName: membership.userName,
    imageUrl,
    role: membership.role,
    joinedAt: membership.joinedAt,
    isMe: membership.user.equals(viewerId),
  };
}

export function invitePayload(invite: GroupInviteDocument, now: Date) {
  return {
    id: idOf(invite),
    code: invite.code,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt ?? null,
    maxUses: invite.maxUses ?? null,
    uses: invite.uses,
    revokedAt: invite.revokedAt ?? null,
    status: inviteStatus(invite, now),
  };
}
