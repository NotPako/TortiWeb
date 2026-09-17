import type { GroupRole } from '@/lib/groups';
import type { InviteStatus } from '@/lib/invites';

/** Campos de `GROUP_FIELDS`. */
export type GroupSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  myRole: GroupRole;
  isAdmin: boolean;
  memberCount: number;
};

export type GroupMemberItem = {
  userName: string;
  imageUrl: string | null;
  role: GroupRole;
  joinedAt: string;
  isMe: boolean;
};

/** Campos de `GROUP_INVITE_FIELDS`. */
export type GroupInviteItem = {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  revokedAt: string | null;
  status: InviteStatus;
};

export type GroupMembersData = {
  group: {
    id: string;
    isAdmin: boolean;
    memberCount: number;
    members: GroupMemberItem[];
    invites: GroupInviteItem[] | null;
  } | null;
};

export type InvitePreviewData = {
  invitePreview: {
    groupName: string;
    groupSlug: string;
    status: InviteStatus;
    alreadyMember: boolean;
  } | null;
};
