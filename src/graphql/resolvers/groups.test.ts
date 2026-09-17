import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';

vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: async () => mongoose,
}));

vi.mock('@/lib/r2', () => ({
  getR2Client: () => ({ send: vi.fn().mockResolvedValue({}) }),
  getR2BucketName: () => 'test-bucket',
  getR2PublicUrl: () => null,
  publicUrlFor: () => null,
}));

import {
  GroupFields,
  Mutation,
  NO_SESSION,
  Query,
  addMember,
  makeGroup,
  makeUser,
  useMemoryDb,
} from './testing';
import { Group } from '@/models/Group';
import { GroupInvite } from '@/models/GroupInvite';
import { Membership } from '@/models/Membership';

useMemoryDb();

type GroupOut = {
  id: string;
  name: string;
  slug: string;
  myRole: string;
  isAdmin: boolean;
  _id: unknown;
  _viewerKey: string;
};
type InviteOut = { id: string; code: string; status: string; uses: number };

function createInvite(
  ctx: unknown,
  extra: { expiresInDays?: number; maxUses?: number } = {}
) {
  return Mutation.createInvite(
    null,
    { input: { groupSlug: 'pena', ...extra } },
    ctx
  ) as Promise<InviteOut>;
}

describe('createGroup', () => {
  it('crea el grupo con slug y deja al creador como admin', async () => {
    const ana = await makeUser('ana');
    const group = (await Mutation.createGroup(
      null,
      { input: { name: '  Peña de l\'Àngel ', description: 'Los miércoles' } },
      ana.ctx
    )) as GroupOut;

    expect(group).toMatchObject({
      name: "Peña de l'Àngel",
      slug: 'pena-de-l-angel',
      myRole: 'admin',
      isAdmin: true,
    });
    const membership = await Membership.findOne({ userKey: 'ana' }).exec();
    expect(membership?.role).toBe('admin');
  });

  it('si el slug está cogido usa el siguiente libre', async () => {
    const ana = await makeUser('ana');
    const vic = await makeUser('vic');
    await Mutation.createGroup(null, { input: { name: 'Peña' } }, ana.ctx);
    const second = (await Mutation.createGroup(
      null,
      { input: { name: 'peña' } },
      vic.ctx
    )) as GroupOut;
    expect(second.slug).toBe('pena-2');
  });

  it('exige sesión y un nombre válido', async () => {
    const ana = await makeUser('ana');
    await expect(
      Mutation.createGroup(null, { input: { name: 'Peña' } }, NO_SESSION)
    ).rejects.toThrow(/sesión/i);
    await expect(
      Mutation.createGroup(null, { input: { name: ' x ' } }, ana.ctx)
    ).rejects.toThrow(/al menos/i);
    expect(await Group.countDocuments()).toBe(0);
  });
});

describe('myGroups y group', () => {
  it('lista solo los grupos propios, ordenados por nombre, con el rol de cada uno', async () => {
    const ana = await makeUser('ana');
    const vic = await makeUser('vic');
    await makeGroup('zeta', { members: [ana] });
    await makeGroup('alfa', { admins: [ana] });
    await makeGroup('ajena', { admins: [vic] });

    const groups = (await Query.myGroups(null, {}, ana.ctx)) as GroupOut[];
    expect(groups.map((g) => [g.slug, g.myRole])).toEqual([
      ['alfa', 'admin'],
      ['zeta', 'member'],
    ]);
  });

  it('sin sesión devuelve lista vacía', async () => {
    expect(await Query.myGroups(null, {}, NO_SESSION)).toEqual([]);
  });

  it('group devuelve null si no eres miembro, igual que si no existiera', async () => {
    const ana = await makeUser('ana');
    const vic = await makeUser('vic');
    await makeGroup('pena', { admins: [vic] });
    expect(await Query.group(null, { slug: 'pena' }, ana.ctx)).toBeNull();
    expect(await Query.group(null, { slug: 'no-existe' }, ana.ctx)).toBeNull();
    expect(await Query.group(null, { slug: 'PENA' }, vic.ctx)).not.toBeNull();
  });

  it('las invitaciones del grupo solo las recibe un admin', async () => {
    const ana = await makeUser('ana');
    const vic = await makeUser('vic');
    await makeGroup('pena', { admins: [ana], members: [vic] });
    await createInvite(ana.ctx);

    const asAdmin = (await Query.group(null, { slug: 'pena' }, ana.ctx)) as GroupOut;
    const asMember = (await Query.group(null, { slug: 'pena' }, vic.ctx)) as GroupOut;
    expect(await GroupFields.invites(asAdmin, {}, ana.ctx)).toHaveLength(1);
    expect(await GroupFields.invites(asMember, {}, vic.ctx)).toBeNull();

    const members = (await GroupFields.members(asMember, {}, vic.ctx)) as Array<{
      userName: string;
      isMe: boolean;
    }>;
    expect(members.map((m) => [m.userName, m.isMe])).toEqual([
      ['ana', false],
      ['vic', true],
    ]);
  });
});

describe('invitaciones', () => {
  async function setup() {
    const jefa = await makeUser('jefa');
    const nuevo = await makeUser('nuevo');
    await makeGroup('pena', { admins: [jefa] });
    return { jefa, nuevo };
  }

  it('un miembro que no es admin no puede invitar', async () => {
    const { jefa } = await setup();
    const vic = await makeUser('vic');
    const group = await Group.findOne({ slug: 'pena' }).exec();
    await addMember(group!, vic);
    void jefa;
    await expect(createInvite(vic.ctx)).rejects.toThrow(/administrador/i);
  });

  it('canjear crea la membresía; aceptando el código con guion y minúsculas', async () => {
    const { jefa, nuevo } = await setup();
    const invite = await createInvite(jefa.ctx);
    const pasted = `${invite.code.slice(0, 4)}-${invite.code.slice(4)}`.toLowerCase();

    const group = (await Mutation.redeemInvite(
      null,
      { code: pasted },
      nuevo.ctx
    )) as GroupOut;
    expect(group).toMatchObject({ slug: 'pena', myRole: 'member' });
    expect(
      await Membership.exists({ group: group.id, userKey: 'nuevo' })
    ).toBeTruthy();
  });

  it('el doble canje es idempotente y no gasta otro uso', async () => {
    const { jefa, nuevo } = await setup();
    const invite = await createInvite(jefa.ctx, { maxUses: 1 });
    await Mutation.redeemInvite(null, { code: invite.code }, nuevo.ctx);
    await expect(
      Mutation.redeemInvite(null, { code: invite.code }, nuevo.ctx)
    ).resolves.toMatchObject({ slug: 'pena' });
    const saved = await GroupInvite.findById(invite.id).exec();
    expect(saved?.uses).toBe(1);
  });

  it('respeta el máximo de usos', async () => {
    const { jefa, nuevo } = await setup();
    const otro = await makeUser('otro');
    const invite = await createInvite(jefa.ctx, { maxUses: 1 });
    await Mutation.redeemInvite(null, { code: invite.code }, nuevo.ctx);
    await expect(
      Mutation.redeemInvite(null, { code: invite.code }, otro.ctx)
    ).rejects.toThrow(/máximo/i);
  });

  it('una invitación revocada no sirve', async () => {
    const { jefa, nuevo } = await setup();
    const invite = await createInvite(jefa.ctx);
    const revoked = (await Mutation.revokeInvite(
      null,
      { id: invite.id },
      jefa.ctx
    )) as InviteOut;
    expect(revoked.status).toBe('revoked');
    await expect(
      Mutation.redeemInvite(null, { code: invite.code }, nuevo.ctx)
    ).rejects.toThrow(/ya no es válida/i);
  });

  it('una invitación caducada no sirve', async () => {
    const { jefa, nuevo } = await setup();
    const invite = await createInvite(jefa.ctx, { expiresInDays: 1 });
    await GroupInvite.updateOne(
      { _id: invite.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    await expect(
      Mutation.redeemInvite(null, { code: invite.code }, nuevo.ctx)
    ).rejects.toThrow(/caducado/i);
  });

  it('un código inexistente da el mismo error genérico', async () => {
    const { nuevo } = await setup();
    await expect(
      Mutation.redeemInvite(null, { code: 'ZZZZZZZZ' }, nuevo.ctx)
    ).rejects.toThrow(/no válida/i);
  });

  it('invitePreview enseña el grupo y si ya eres miembro', async () => {
    const { jefa, nuevo } = await setup();
    const invite = await createInvite(jefa.ctx);
    expect(
      await Query.invitePreview(null, { code: invite.code }, nuevo.ctx)
    ).toEqual({
      groupName: 'pena',
      groupSlug: 'pena',
      status: 'active',
      alreadyMember: false,
    });
    expect(
      await Query.invitePreview(null, { code: invite.code }, jefa.ctx)
    ).toMatchObject({ alreadyMember: true });
    expect(
      await Query.invitePreview(null, { code: 'ZZZZZZZZ' }, nuevo.ctx)
    ).toBeNull();
  });

  it('un admin de otro grupo no puede revocar invitaciones ajenas', async () => {
    const { jefa } = await setup();
    const invite = await createInvite(jefa.ctx);
    const ajeno = await makeUser('ajeno');
    await makeGroup('otra-pena', { admins: [ajeno] });
    await expect(
      Mutation.revokeInvite(null, { id: invite.id }, ajeno.ctx)
    ).rejects.toThrow(/no válida/i);
  });
});

describe('setUsername', () => {
  it('mueve las membresías a la nueva clave de usuario', async () => {
    const google = await makeUser('g_555');
    await makeGroup('pena', { members: [google] });

    await Mutation.setUsername(null, { username: 'Nuevo' }, google.ctx);

    const membership = await Membership.findOne({}).exec();
    expect(membership).toMatchObject({ userKey: 'nuevo', userName: 'Nuevo' });
  });
});

describe('roles y salida del grupo', () => {
  async function setup() {
    const jefa = await makeUser('jefa');
    const vic = await makeUser('vic');
    await makeGroup('pena', { admins: [jefa], members: [vic] });
    return { jefa, vic };
  }

  it('un admin puede nombrar a otro admin', async () => {
    const { jefa, vic } = await setup();
    const member = (await Mutation.setMemberRole(
      null,
      { groupSlug: 'pena', userName: 'Vic', role: 'admin' },
      jefa.ctx
    )) as { role: string };
    expect(member.role).toBe('admin');
    // Y el nuevo admin ya puede administrar.
    await expect(
      Mutation.announceTortilla(null, { input: { groupSlug: 'pena' } }, vic.ctx)
    ).resolves.toMatchObject({ open: true });
  });

  it('un miembro no puede cambiar roles', async () => {
    const { vic } = await setup();
    await expect(
      Mutation.setMemberRole(
        null,
        { groupSlug: 'pena', userName: 'vic', role: 'admin' },
        vic.ctx
      )
    ).rejects.toThrow(/administrador/i);
  });

  it('el grupo nunca se queda sin admins', async () => {
    const { jefa } = await setup();
    await expect(
      Mutation.setMemberRole(
        null,
        { groupSlug: 'pena', userName: 'jefa', role: 'member' },
        jefa.ctx
      )
    ).rejects.toThrow(/sin admins/i);
    await expect(
      Mutation.leaveGroup(null, { groupSlug: 'pena' }, jefa.ctx)
    ).rejects.toThrow(/sin admins/i);
  });

  it('un miembro puede salir y deja de ver el grupo', async () => {
    const { vic } = await setup();
    await expect(
      Mutation.leaveGroup(null, { groupSlug: 'pena' }, vic.ctx)
    ).resolves.toBe(true);
    expect(await Query.group(null, { slug: 'pena' }, vic.ctx)).toBeNull();
  });

  it('un admin expulsa a un miembro, pero no a sí mismo', async () => {
    const { jefa } = await setup();
    await expect(
      Mutation.removeMember(
        null,
        { groupSlug: 'pena', userName: 'jefa' },
        jefa.ctx
      )
    ).rejects.toThrow(/salir del grupo/i);
    await expect(
      Mutation.removeMember(null, { groupSlug: 'pena', userName: 'vic' }, jefa.ctx)
    ).resolves.toBe(true);
    expect(await Membership.exists({ userKey: 'vic' })).toBeNull();
  });
});
