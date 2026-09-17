import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';

// La conexión real lanza si falta MONGODB_URI y abriría Atlas: la sustituimos
// por la conexión a la BD en memoria que monta `useMemoryDb`.
vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: async () => mongoose,
}));

// R2 no está disponible en test: stubs que no tocan la red.
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
  useMemoryDb,
} from './testing';
import { Tortilla } from '@/models/Tortilla';
import { Vote } from '@/models/Vote';
import { Comment } from '@/models/Comment';

useMemoryDb();

async function oneGroup() {
  const jefa = await makeUser('jefa');
  const pepe = await makeUser('pepe');
  const group = await makeGroup('pena', { admins: [jefa], members: [pepe] });
  return { jefa, pepe, group };
}

describe('createTortilla', () => {
  it('solo lo puede hacer un admin del grupo', async () => {
    const { pepe } = await oneGroup();
    await expect(
      Mutation.createTortilla(null, tortillaInput('pena'), pepe.ctx)
    ).rejects.toThrow(/administrador/i);
  });

  it('guarda la tortilla en el grupo del admin', async () => {
    const { jefa, group } = await oneGroup();
    await Mutation.createTortilla(null, tortillaInput('pena'), jefa.ctx);
    const saved = await Tortilla.findOne({ name: 'De patata' }).exec();
    expect(saved?.group.toString()).toBe(group._id.toString());
  });
});

describe('castVote solo permite votar la jornada en curso', () => {
  it('rechaza votar una tortilla antigua', async () => {
    const { pepe, group } = await oneGroup();
    const older = await makeTortilla(group, {
      name: 'Vieja',
      date: new Date(2026, 0, 1),
    });
    await makeTortilla(group, { name: 'Nueva', date: new Date(2026, 5, 10) });

    await expect(
      Mutation.castVote(
        null,
        { input: { tortillaId: older._id.toString(), score: 8 } },
        pepe.ctx
      )
    ).rejects.toThrow(/cerrada/i);
  });

  it('permite votar la más reciente y guarda el grupo en el voto', async () => {
    const { pepe, group } = await oneGroup();
    const latest = await makeTortilla(group, {
      name: 'Nueva',
      date: new Date(2026, 5, 10),
    });

    const vote = (await Mutation.castVote(
      null,
      { input: { tortillaId: latest._id.toString(), score: 8.5 } },
      pepe.ctx
    )) as { score: number; userName: string };
    expect(vote.score).toBe(8.5);
    expect(vote.userName).toBe('pepe');

    const saved = await Vote.findOne({ userKey: 'pepe' }).exec();
    expect(saved?.group.toString()).toBe(group._id.toString());
  });

  it('permite votar cualquiera de las dos tortillas del mismo día', async () => {
    const { pepe, group } = await oneGroup();
    const a = await makeTortilla(group, {
      name: 'De patata',
      date: new Date(2026, 5, 10, 12, 0),
    });
    const b = await makeTortilla(group, {
      name: 'De calabacín',
      date: new Date(2026, 5, 10, 14, 30),
    });

    const voteA = (await Mutation.castVote(
      null,
      { input: { tortillaId: a._id.toString(), score: 7 } },
      pepe.ctx
    )) as { score: number };
    const voteB = (await Mutation.castVote(
      null,
      { input: { tortillaId: b._id.toString(), score: 9 } },
      pepe.ctx
    )) as { score: number };

    expect(voteA.score).toBe(7);
    expect(voteB.score).toBe(9);
  });

  it('subir una tortilla de un día posterior cierra la jornada anterior', async () => {
    const { pepe, group } = await oneGroup();
    const ayer = await makeTortilla(group, {
      name: 'De ayer',
      date: new Date(2026, 5, 10),
    });
    await makeTortilla(group, { name: 'De hoy', date: new Date(2026, 5, 17) });

    await expect(
      Mutation.castVote(
        null,
        { input: { tortillaId: ayer._id.toString(), score: 8 } },
        pepe.ctx
      )
    ).rejects.toThrow(/cerrada/i);
  });

  it('la jornada en curso es por grupo: otro grupo más reciente no la cierra', async () => {
    const { pepe, group } = await oneGroup();
    const otro = await makeGroup('otra-pena');
    const nuestra = await makeTortilla(group, {
      name: 'Nuestra',
      date: new Date(2026, 5, 10),
    });
    await makeTortilla(otro, { name: 'Suya', date: new Date(2026, 5, 17) });

    const vote = (await Mutation.castVote(
      null,
      { input: { tortillaId: nuestra._id.toString(), score: 8 } },
      pepe.ctx
    )) as { score: number };
    expect(vote.score).toBe(8);
  });
});

describe('currentTortillas devuelve la jornada completa del grupo', () => {
  it('devuelve las dos tortillas del mismo día', async () => {
    const { pepe, group } = await oneGroup();
    await makeTortilla(group, {
      name: 'De patata',
      date: new Date(2026, 5, 10, 12, 0),
    });
    await makeTortilla(group, {
      name: 'De calabacín',
      date: new Date(2026, 5, 10, 14, 30),
    });

    const list = (await Query.currentTortillas(
      null,
      { groupSlug: 'pena' },
      pepe.ctx
    )) as Array<{ name: string }>;
    expect(list.map((t) => t.name).sort()).toEqual(['De calabacín', 'De patata']);
  });

  it('excluye las de días anteriores y las cerradas a mano', async () => {
    const { pepe, group } = await oneGroup();
    await makeTortilla(group, { name: 'Vieja', date: new Date(2026, 5, 3) });
    await makeTortilla(group, {
      name: 'Abierta',
      date: new Date(2026, 5, 10, 12, 0),
    });
    await makeTortilla(group, {
      name: 'Cerrada',
      date: new Date(2026, 5, 10, 14, 0),
      closedAt: new Date(),
    });

    const list = (await Query.currentTortillas(
      null,
      { groupSlug: 'pena' },
      pepe.ctx
    )) as Array<{ name: string }>;
    expect(list.map((t) => t.name)).toEqual(['Abierta']);
  });

  it('sin tortillas devuelve lista vacía', async () => {
    const { pepe } = await oneGroup();
    const list = await Query.currentTortillas(
      null,
      { groupSlug: 'pena' },
      pepe.ctx
    );
    expect(list).toEqual([]);
  });
});

describe('deleteTortilla y closeTortillaVoting', () => {
  it('borrar una tortilla borra también sus votos y comentarios', async () => {
    const { jefa, pepe, group } = await oneGroup();
    const tortilla = await makeTortilla(group, {
      name: 'Nueva',
      date: new Date(2026, 5, 10),
    });
    const tortillaId = tortilla._id.toString();
    await Mutation.castVote(null, { input: { tortillaId, score: 8 } }, pepe.ctx);
    await Mutation.addComment(
      null,
      { input: { tortillaId, text: 'Buenísima' } },
      pepe.ctx
    );

    await Mutation.deleteTortilla(null, { id: tortillaId }, jefa.ctx);

    expect(await Vote.countDocuments({ tortilla: tortilla._id })).toBe(0);
    expect(await Comment.countDocuments({ tortilla: tortilla._id })).toBe(0);
  });

  it('un miembro sin rol de admin no puede cerrar la votación', async () => {
    const { pepe, group } = await oneGroup();
    const tortilla = await makeTortilla(group, {
      name: 'Nueva',
      date: new Date(2026, 5, 10),
    });
    await expect(
      Mutation.closeTortillaVoting(
        null,
        { id: tortilla._id.toString() },
        pepe.ctx
      )
    ).rejects.toThrow(/administrador/i);
  });
});

describe('comentarios', () => {
  it('se guardan con el grupo y solo los borra su autor', async () => {
    const { jefa, pepe, group } = await oneGroup();
    const tortilla = await makeTortilla(group, {
      name: 'Nueva',
      date: new Date(2026, 5, 10),
    });
    const comment = (await Mutation.addComment(
      null,
      { input: { tortillaId: tortilla._id.toString(), text: 'Rica' } },
      pepe.ctx
    )) as { id: string };

    const saved = await Comment.findById(comment.id).exec();
    expect(saved?.group.toString()).toBe(group._id.toString());

    await expect(
      Mutation.deleteComment(null, { id: comment.id }, jefa.ctx)
    ).rejects.toThrow(/propios/i);
    await expect(
      Mutation.deleteComment(null, { id: comment.id }, pepe.ctx)
    ).resolves.toBe(true);
  });
});
