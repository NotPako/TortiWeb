import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// La conexión real lanza si falta MONGODB_URI y abriría Atlas: la sustituimos
// por la conexión a la BD en memoria que montamos en beforeAll.
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

import { resolvers } from './resolvers';
import { User } from '@/models/User';
import { Tortilla } from '@/models/Tortilla';
import { TortillaEvent } from '@/models/TortillaEvent';

type AnyResolver = (parent: unknown, args: unknown, ctx: unknown) => unknown;
const Query = resolvers.Query as Record<string, AnyResolver>;
const Mutation = resolvers.Mutation as Record<string, AnyResolver>;

let mongod: MongoMemoryServer;

/** Crea un usuario y devuelve un ctx de sesión con su rol. */
async function makeUser(
  username: string,
  role: 'user' | 'admin' = 'user'
) {
  const usernameKey = username.toLowerCase();
  const doc = await User.create({
    username,
    usernameKey,
    email: `${usernameKey}@test.dev`,
    emailKey: `${usernameKey}@test.dev`,
    role,
  });
  const id = doc._id.toString();
  const ctx = {
    session: {
      user: {
        id,
        username,
        usernameKey,
        email: `${usernameKey}@test.dev`,
        needsUsername: false,
        role,
      },
    },
  };
  return { doc, ctx };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe('announceTortilla (roles + invariantes)', () => {
  it('rechaza a usuarios no admin', async () => {
    const { ctx } = await makeUser('pepe', 'user');
    await expect(
      Mutation.announceTortilla(null, { input: {} }, ctx)
    ).rejects.toThrow(/administrador/i);
  });

  it('un admin convoca y queda como convocatoria abierta', async () => {
    const { ctx } = await makeUser('jefa', 'admin');
    const event = (await Mutation.announceTortilla(
      null,
      { input: { note: 'traed pan' } },
      ctx
    )) as { open: boolean; note: string; attendeeCount: number };

    expect(event.open).toBe(true);
    expect(event.note).toBe('traed pan');
    expect(event.attendeeCount).toBe(0);

    const upcoming = await Query.upcomingTortilla(null, {}, ctx);
    expect(upcoming).not.toBeNull();
  });

  it('no permite dos convocatorias abiertas a la vez', async () => {
    const { ctx } = await makeUser('jefa', 'admin');
    await Mutation.announceTortilla(null, { input: {} }, ctx);
    await expect(
      Mutation.announceTortilla(null, { input: {} }, ctx)
    ).rejects.toThrow(/ya hay una convocatoria/i);
  });
});

describe('setAttendance (apuntarse / desapuntarse)', () => {
  it('apunta y desapunta al usuario, actualizando el recuento', async () => {
    const { ctx: admin } = await makeUser('jefa', 'admin');
    const { ctx: user } = await makeUser('pepe', 'user');
    const event = (await Mutation.announceTortilla(
      null,
      { input: {} },
      admin
    )) as { id: string };

    const joined = (await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      user
    )) as { attendeeCount: number; isAttending: boolean };
    expect(joined.attendeeCount).toBe(1);
    expect(joined.isAttending).toBe(true);

    // Idempotente: volver a apuntarse no duplica.
    const again = (await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      user
    )) as { attendeeCount: number };
    expect(again.attendeeCount).toBe(1);

    const left = (await Mutation.setAttendance(
      null,
      { id: event.id, attending: false },
      user
    )) as { attendeeCount: number; isAttending: boolean };
    expect(left.attendeeCount).toBe(0);
    expect(left.isAttending).toBe(false);
  });

  it('no deja apuntarse en una convocatoria cerrada', async () => {
    const { ctx: admin } = await makeUser('jefa', 'admin');
    const { ctx: user } = await makeUser('pepe', 'user');
    const event = (await Mutation.announceTortilla(
      null,
      { input: {} },
      admin
    )) as { id: string };
    await Mutation.closeTortillaEvent(null, { id: event.id }, admin);

    await expect(
      Mutation.setAttendance(null, { id: event.id, attending: true }, user)
    ).rejects.toThrow(/cerrada/i);
  });
});

describe('createTortilla auto-cierra la convocatoria abierta', () => {
  it('al subir la tortilla cocinada, la convocatoria se cierra', async () => {
    const { ctx: admin } = await makeUser('jefa', 'admin');
    await Mutation.announceTortilla(null, { input: {} }, admin);

    await Mutation.createTortilla(
      null,
      {
        input: {
          name: 'De patata',
          imageBase64: 'aGVsbG8=', // "hello"
          imageContentType: 'image/png',
        },
      },
      admin
    );

    const stillOpen = await TortillaEvent.findOne({ closedAt: null }).exec();
    expect(stillOpen).toBeNull();
  });
});

describe('castVote solo permite votar la tortilla más reciente', () => {
  it('rechaza votar una tortilla antigua', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    const older = await Tortilla.create({
      name: 'Vieja',
      date: new Date(2026, 0, 1),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
    await Tortilla.create({
      name: 'Nueva',
      date: new Date(2026, 5, 10),
      imageKey: 'k2',
      imageContentType: 'image/png',
    });

    await expect(
      Mutation.castVote(
        null,
        { input: { tortillaId: older._id.toString(), score: 8 } },
        user
      )
    ).rejects.toThrow(/cerrada/i);
  });

  it('permite votar la más reciente', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    const latest = await Tortilla.create({
      name: 'Nueva',
      date: new Date(2026, 5, 10),
      imageKey: 'k2',
      imageContentType: 'image/png',
    });

    const vote = (await Mutation.castVote(
      null,
      { input: { tortillaId: latest._id.toString(), score: 8.5 } },
      user
    )) as { score: number; userName: string };
    expect(vote.score).toBe(8.5);
    expect(vote.userName).toBe('pepe');
  });
});
