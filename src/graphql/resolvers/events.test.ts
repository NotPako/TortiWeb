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
  Mutation,
  NO_SESSION,
  Query,
  makeGroup,
  makeUser,
  tortillaInput,
  useMemoryDb,
} from './testing';
import { TortillaEvent } from '@/models/TortillaEvent';

useMemoryDb();

type EventOut = {
  id: string;
  open: boolean;
  note: string | null;
  attendeeCount: number;
  isAttending: boolean;
  attendees: Array<{
    userName: string;
    allergens: string[] | null;
    allergyNotes: string | null;
  }>;
};

async function oneGroup() {
  const jefa = await makeUser('jefa');
  const pepe = await makeUser('pepe');
  const group = await makeGroup('pena', { admins: [jefa], members: [pepe] });
  return { jefa, pepe, group };
}

function announce(ctx: unknown, groupSlug = 'pena', note?: string) {
  return Mutation.announceTortilla(
    null,
    { input: { groupSlug, note } },
    ctx
  ) as Promise<EventOut>;
}

describe('announceTortilla (roles + invariantes)', () => {
  it('rechaza a miembros que no son admin', async () => {
    const { pepe } = await oneGroup();
    await expect(announce(pepe.ctx)).rejects.toThrow(/administrador/i);
  });

  it('un admin convoca y queda como convocatoria abierta', async () => {
    const { jefa } = await oneGroup();
    const event = await announce(jefa.ctx, 'pena', 'traed pan');

    expect(event.open).toBe(true);
    expect(event.note).toBe('traed pan');
    expect(event.attendeeCount).toBe(0);

    const upcoming = await Query.upcomingTortilla(
      null,
      { groupSlug: 'pena' },
      jefa.ctx
    );
    expect(upcoming).not.toBeNull();
  });

  it('no permite dos convocatorias abiertas a la vez en el mismo grupo', async () => {
    const { jefa } = await oneGroup();
    await announce(jefa.ctx);
    await expect(announce(jefa.ctx)).rejects.toThrow(/ya hay una convocatoria/i);
  });

  it('dos grupos pueden tener cada uno su convocatoria abierta', async () => {
    const { jefa } = await oneGroup();
    const otroAdmin = await makeUser('otro');
    await makeGroup('otra-pena', { admins: [otroAdmin] });

    await announce(jefa.ctx, 'pena');
    await expect(announce(otroAdmin.ctx, 'otra-pena')).resolves.toMatchObject({
      open: true,
    });
  });
});

describe('setAttendance (apuntarse / desapuntarse)', () => {
  it('apunta y desapunta al usuario, actualizando el recuento', async () => {
    const { jefa, pepe } = await oneGroup();
    const event = await announce(jefa.ctx);

    const joined = (await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      pepe.ctx
    )) as EventOut;
    expect(joined.attendeeCount).toBe(1);
    expect(joined.isAttending).toBe(true);

    // Idempotente: volver a apuntarse no duplica.
    const again = (await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      pepe.ctx
    )) as EventOut;
    expect(again.attendeeCount).toBe(1);

    const left = (await Mutation.setAttendance(
      null,
      { id: event.id, attending: false },
      pepe.ctx
    )) as EventOut;
    expect(left.attendeeCount).toBe(0);
    expect(left.isAttending).toBe(false);
  });

  it('no deja apuntarse en una convocatoria cerrada', async () => {
    const { jefa, pepe } = await oneGroup();
    const event = await announce(jefa.ctx);
    await Mutation.closeTortillaEvent(null, { id: event.id }, jefa.ctx);

    await expect(
      Mutation.setAttendance(null, { id: event.id, attending: true }, pepe.ctx)
    ).rejects.toThrow(/cerrada/i);
  });
});

describe('createTortilla auto-cierra la convocatoria abierta', () => {
  it('cierra la del grupo y deja intacta la de otro grupo', async () => {
    const { jefa } = await oneGroup();
    const otroAdmin = await makeUser('otro');
    await makeGroup('otra-pena', { admins: [otroAdmin] });
    await announce(jefa.ctx, 'pena');
    const ajena = await announce(otroAdmin.ctx, 'otra-pena');

    await Mutation.createTortilla(null, tortillaInput('pena'), jefa.ctx);

    const open = await TortillaEvent.find({ closedAt: null }).exec();
    expect(open.map((e) => e._id.toString())).toEqual([ajena.id]);
  });
});

describe('alergias: guardado y visibilidad en la convocatoria', () => {
  /** Jefa convoca en "pena"; Ana (celiaca) se apunta; Curioso es miembro. */
  async function setup() {
    const jefa = await makeUser('jefa');
    const ana = await makeUser('ana');
    const curioso = await makeUser('curioso');
    await makeGroup('pena', { admins: [jefa], members: [ana, curioso] });
    await Mutation.setAllergies(
      null,
      { input: { allergens: ['milk', 'gluten'], allergyNotes: '  kiwi  ' } },
      ana.ctx
    );
    const event = await announce(jefa.ctx);
    await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      ana.ctx
    );
    return { jefa, ana, curioso, event };
  }

  function upcoming(ctx: unknown) {
    return Query.upcomingTortilla(
      null,
      { groupSlug: 'pena' },
      ctx
    ) as Promise<EventOut>;
  }

  it('setAllergies normaliza orden, observaciones y lo devuelve en me', async () => {
    const ana = await makeUser('ana');
    await Mutation.setAllergies(
      null,
      { input: { allergens: ['milk', 'gluten', 'milk'], allergyNotes: ' kiwi ' } },
      ana.ctx
    );
    const me = (await Query.me(null, {}, ana.ctx)) as {
      allergens: string[];
      allergyNotes: string | null;
    };
    expect(me.allergens).toEqual(['gluten', 'milk']);
    expect(me.allergyNotes).toBe('kiwi');
  });

  it('setAllergies con lista vacía y notas vacías lo borra todo', async () => {
    const ana = await makeUser('ana');
    await Mutation.setAllergies(
      null,
      { input: { allergens: ['eggs'], allergyNotes: 'kiwi' } },
      ana.ctx
    );
    await Mutation.setAllergies(
      null,
      { input: { allergens: [], allergyNotes: '' } },
      ana.ctx
    );
    const me = (await Query.me(null, {}, ana.ctx)) as {
      allergens: string[];
      allergyNotes: string | null;
    };
    expect(me.allergens).toEqual([]);
    expect(me.allergyNotes).toBeNull();
  });

  it('setAllergies rechaza alérgenos desconocidos y exige sesión', async () => {
    const ana = await makeUser('ana');
    await expect(
      Mutation.setAllergies(null, { input: { allergens: ['chocolate'] } }, ana.ctx)
    ).rejects.toThrow(/no válido/i);
    await expect(
      Mutation.setAllergies(null, { input: { allergens: [] } }, NO_SESSION)
    ).rejects.toThrow(/sesión/i);
  });

  it('el admin del grupo ve las alergias de los apuntados', async () => {
    const { jefa } = await setup();
    const event = await upcoming(jefa.ctx);
    expect(event.attendees[0]).toMatchObject({
      userName: 'ana',
      allergens: ['gluten', 'milk'],
      allergyNotes: 'kiwi',
    });
  });

  it('un apuntado ve las alergias del resto de apuntados', async () => {
    const { curioso, event } = await setup();
    await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      curioso.ctx
    );
    const seen = await upcoming(curioso.ctx);
    const ana = seen.attendees.find((a) => a.userName === 'ana');
    expect(ana?.allergens).toEqual(['gluten', 'milk']);
  });

  it('un miembro que no está apuntado ni es admin recibe null (no "sin alergias")', async () => {
    const { curioso } = await setup();
    const seen = await upcoming(curioso.ctx);
    expect(seen.attendees[0].allergens).toBeNull();
    expect(seen.attendees[0].allergyNotes).toBeNull();
  });

  it('ser admin de OTRO grupo no da acceso a la convocatoria ni a sus alergias', async () => {
    await setup();
    const ajeno = await makeUser('ajeno');
    await makeGroup('otra-pena', { admins: [ajeno] });
    await expect(upcoming(ajeno.ctx)).rejects.toThrow(/no encontrado/i);
  });

  it('sin sesión no se puede consultar la convocatoria', async () => {
    await setup();
    await expect(upcoming(NO_SESSION)).rejects.toThrow(/sesión/i);
  });

  it('al expulsar a un apuntado deja de figurar en la convocatoria abierta', async () => {
    const { jefa } = await setup();
    await Mutation.removeMember(
      null,
      { groupSlug: 'pena', userName: 'ana' },
      jefa.ctx
    );
    const event = await upcoming(jefa.ctx);
    expect(event.attendeeCount).toBe(0);
  });
});
