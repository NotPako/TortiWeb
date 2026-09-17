import { Types } from 'mongoose';
import { Vote } from '@/models/Vote';
import { User, userImageUrl } from '@/models/User';
import type { TortillaDocument } from '@/models/Tortilla';
import type { TortillaEventDocument } from '@/models/TortillaEvent';
import type { GroupDocument } from '@/models/Group';
import type { MembershipDocument } from '@/models/Membership';
import type { GroupInviteDocument } from '@/models/GroupInvite';
import { inviteStatus } from '@/lib/invites';
import { buildImageUrl } from './media';

function idOf(doc: { _id: unknown }): string {
  return (doc._id as Types.ObjectId).toString();
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
  userKey: string | null
) {
  const { averageScore, voteCount } = await computeStats(
    doc._id as Types.ObjectId
  );
  const closedAt = doc.closedAt ?? null;
  // La votación está abierta mientras la tortilla sea de la jornada en curso
  // y no se haya cerrado manualmente. Lo primero se aplica en
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
    _ctxUserKey: userKey,
  };
}

export type ResolvedTortilla = Awaited<ReturnType<typeof tortillaPayload>>;

/** Quién mira la convocatoria. `isAdmin` es admin del grupo de la convocatoria. */
export type EventViewer = { userKey: string; isAdmin: boolean };

export async function eventPayload(
  doc: TortillaEventDocument,
  viewer: EventViewer
) {
  const attendeeKeys = doc.attendees.map((a) => a.userKey);
  const users = attendeeKeys.length
    ? await User.find({ usernameKey: { $in: attendeeKeys } })
        .select('usernameKey image imageKey allergens allergyNotes')
        .exec()
    : [];
  const userByKey = new Map(users.map((u) => [u.usernameKey, u]));

  const isAttending = doc.attendees.some((a) => a.userKey === viewer.userKey);
  // Las alergias son datos de salud: solo las ven los admins de este grupo
  // (rol leído de la BD) y quienes están apuntados a esta misma convocatoria.
  // Para el resto van a null, que NO significa "sin alergias".
  const canSeeAllergies = isAttending || viewer.isAdmin;

  // Orden de llegada (joinedAt asc) para que la lista sea estable.
  const attendees = [...doc.attendees]
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((a) => {
      const user = userByKey.get(a.userKey);
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
    isAttending,
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
    _viewerKey: membership.userKey,
  };
}

export type ResolvedGroup = ReturnType<typeof groupPayload>;

export function memberPayload(
  membership: MembershipDocument,
  imageUrl: string | null,
  viewerKey: string
) {
  return {
    userName: membership.userName,
    imageUrl,
    role: membership.role,
    joinedAt: membership.joinedAt,
    isMe: membership.userKey === viewerKey,
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
