/**
 * Aislamiento entre grupos: lo que se gana o se pierde con multi-grupo.
 *
 * Fixture: dos grupos, "a" y "b", cada uno con su admin, un miembro, una
 * tortilla del día y una convocatoria abierta. Casi todos los tests son
 * "alguien de A intenta tocar algo de B". Un fallo aquí es una fuga de datos.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
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
  Mutation,
  Query,
  makeGroup,
  makeTortilla,
  makeUser,
  tortillaInput,
  type TestUser,
} from './testing';
import { useMemoryDb } from './testing';
import { Tortilla } from '@/models/Tortilla';
import { TortillaEvent } from '@/models/TortillaEvent';
import { Vote } from '@/models/Vote';

useMemoryDb();

type World = {
  adminA: TestUser;
  memberA: TestUser;
  adminB: TestUser;
  memberB: TestUser;
  tortillaB: string;
  eventB: string;
  commentB: string;
};

let w: World;

beforeEach(async () => {
  const adminA = await makeUser('adminA');
  const memberA = await makeUser('memberA');
  const adminB = await makeUser('adminB');
  const memberB = await makeUser('memberB');
  const a = await makeGroup('a', { admins: [adminA], members: [memberA] });
  const b = await makeGroup('b', { admins: [adminB], members: [memberB] });

  const today = new Date(2026, 5, 10);
  await makeTortilla(a, { name: 'Tortilla A', date: today });
  const tortillaB = await makeTortilla(b, { name: 'Tortilla B', date: today });

  const eventB = (await Mutation.announceTortilla(
    null,
    { input: { groupSlug: 'b' } },
    adminB.ctx
  )) as { id: string };
  await Mutation.castVote(
    null,
    { input: { tortillaId: tortillaB._id.toString(), score: 9 } },
    memberB.ctx
  );
  const commentB = (await Mutation.addComment(
    null,
    { input: { tortillaId: tortillaB._id.toString(), text: 'De B' } },
    memberB.ctx
  )) as { id: string };

  w = {
    adminA,
    memberA,
    adminB,
    memberB,
    tortillaB: tortillaB._id.toString(),
    eventB: eventB.id,
    commentB: commentB.id,
  };
});

const NOT_FOUND = /no encontrad|no válida/i;

describe('queries de un grupo ajeno', () => {
  it('tortillas', async () => {
    await expect(
      Query.tortillas(null, { groupSlug: 'b' }, w.memberA.ctx)
    ).rejects.toThrow(NOT_FOUND);
    // Y el propio grupo no mezcla las de B.
    const own = (await Query.tortillas(
      null,
      { groupSlug: 'a' },
      w.memberA.ctx
    )) as Array<{ name: string }>;
    expect(own.map((t) => t.name)).toEqual(['Tortilla A']);
  });

  it('tortilla por id devuelve null', async () => {
    expect(
      await Query.tortilla(null, { id: w.tortillaB }, w.adminA.ctx)
    ).toBeNull();
  });

  it('currentTortillas', async () => {
    await expect(
      Query.currentTortillas(null, { groupSlug: 'b' }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
  });

  it('upcomingTortilla', async () => {
    await expect(
      Query.upcomingTortilla(null, { groupSlug: 'b' }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
    expect(
      await Query.upcomingTortilla(null, { groupSlug: 'a' }, w.adminA.ctx)
    ).toBeNull();
  });

  it('myStats', async () => {
    await expect(
      Query.myStats(null, { groupSlug: 'b' }, w.memberA.ctx)
    ).rejects.toThrow(NOT_FOUND);
  });

  it('userStats falla aunque conozcas el username', async () => {
    await expect(
      Query.userStats(
        null,
        { groupSlug: 'b', username: 'memberB' },
        w.memberA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
  });

  it('userStats desde tu grupo no revela a alguien que solo está en otro', async () => {
    expect(
      await Query.userStats(
        null,
        { groupSlug: 'a', username: 'memberB' },
        w.memberA.ctx
      )
    ).toBeNull();
  });

  it('las stats no mezclan votos de otros grupos', async () => {
    // memberB entra también en A y vota allí: sus stats en A cuentan 1 voto.
    const tortillaA = await Tortilla.findOne({ name: 'Tortilla A' }).exec();
    const groupA = tortillaA!.group;
    await mongoose.model('Membership').create({
      group: groupA,
      userKey: 'memberb',
      userName: 'memberB',
      role: 'member',
    });
    await Mutation.castVote(
      null,
      { input: { tortillaId: tortillaA!._id.toString(), score: 5 } },
      w.memberB.ctx
    );

    const inA = (await Query.myStats(
      null,
      { groupSlug: 'a' },
      w.memberB.ctx
    )) as { totalVotes: number; averageGiven: number };
    const inB = (await Query.myStats(
      null,
      { groupSlug: 'b' },
      w.memberB.ctx
    )) as { totalVotes: number; averageGiven: number };
    expect([inA.totalVotes, inA.averageGiven]).toEqual([1, 5]);
    expect([inB.totalVotes, inB.averageGiven]).toEqual([1, 9]);
  });
});

describe('mutations sobre un grupo ajeno', () => {
  it('createTortilla: admin de A no sube en B', async () => {
    await expect(
      Mutation.createTortilla(null, tortillaInput('b'), w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
  });

  it('deleteTortilla: admin de A no borra la de B', async () => {
    await expect(
      Mutation.deleteTortilla(null, { id: w.tortillaB }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
    expect(await Tortilla.exists({ _id: w.tortillaB })).toBeTruthy();
  });

  it('closeTortillaVoting', async () => {
    await expect(
      Mutation.closeTortillaVoting(null, { id: w.tortillaB }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
  });

  it('castVote: miembro de A no vota en B', async () => {
    await expect(
      Mutation.castVote(
        null,
        { input: { tortillaId: w.tortillaB, score: 1 } },
        w.memberA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
    expect(await Vote.countDocuments({ userKey: 'membera' })).toBe(0);
  });

  it('addComment', async () => {
    await expect(
      Mutation.addComment(
        null,
        { input: { tortillaId: w.tortillaB, text: 'Hola' } },
        w.memberA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
  });

  it('deleteComment', async () => {
    await expect(
      Mutation.deleteComment(null, { id: w.commentB }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
  });

  it('announceTortilla', async () => {
    await expect(
      Mutation.announceTortilla(
        null,
        { input: { groupSlug: 'b' } },
        w.adminA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
  });

  it('closeTortillaEvent', async () => {
    await expect(
      Mutation.closeTortillaEvent(null, { id: w.eventB }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
    const event = await TortillaEvent.findById(w.eventB).exec();
    expect(event?.closedAt).toBeFalsy();
  });

  it('setAttendance', async () => {
    await expect(
      Mutation.setAttendance(
        null,
        { id: w.eventB, attending: true },
        w.memberA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
  });

  it('gestión de miembros e invitaciones de B', async () => {
    await expect(
      Mutation.createInvite(null, { input: { groupSlug: 'b' } }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
    await expect(
      Mutation.setMemberRole(
        null,
        { groupSlug: 'b', userName: 'memberB', role: 'admin' },
        w.adminA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
    await expect(
      Mutation.removeMember(
        null,
        { groupSlug: 'b', userName: 'memberB' },
        w.adminA.ctx
      )
    ).rejects.toThrow(NOT_FOUND);
    await expect(
      Mutation.leaveGroup(null, { groupSlug: 'b' }, w.adminA.ctx)
    ).rejects.toThrow(NOT_FOUND);
  });
});
