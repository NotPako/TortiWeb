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
import { Vote } from '@/models/Vote';
import { Comment } from '@/models/Comment';

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

describe('castVote solo permite votar la jornada en curso', () => {
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

  it('permite votar cualquiera de las dos tortillas del mismo día', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    // Mismo día natural, subidas a horas distintas.
    const a = await Tortilla.create({
      name: 'De patata',
      date: new Date(2026, 5, 10, 12, 0),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
    const b = await Tortilla.create({
      name: 'De calabacín',
      date: new Date(2026, 5, 10, 14, 30),
      imageKey: 'k2',
      imageContentType: 'image/png',
    });

    // La "no más reciente" del día también debe aceptarse.
    const voteA = (await Mutation.castVote(
      null,
      { input: { tortillaId: a._id.toString(), score: 7 } },
      user
    )) as { score: number };
    const voteB = (await Mutation.castVote(
      null,
      { input: { tortillaId: b._id.toString(), score: 9 } },
      user
    )) as { score: number };

    expect(voteA.score).toBe(7);
    expect(voteB.score).toBe(9);
  });

  it('subir una tortilla de un día posterior cierra la jornada anterior', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    const ayer = await Tortilla.create({
      name: 'De ayer',
      date: new Date(2026, 5, 10),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
    await Tortilla.create({
      name: 'De hoy',
      date: new Date(2026, 5, 17),
      imageKey: 'k2',
      imageContentType: 'image/png',
    });

    await expect(
      Mutation.castVote(
        null,
        { input: { tortillaId: ayer._id.toString(), score: 8 } },
        user
      )
    ).rejects.toThrow(/cerrada/i);
  });
});

describe('currentTortillas devuelve la jornada completa', () => {
  it('devuelve las dos tortillas del mismo día', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    await Tortilla.create({
      name: 'De patata',
      date: new Date(2026, 5, 10, 12, 0),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
    await Tortilla.create({
      name: 'De calabacín',
      date: new Date(2026, 5, 10, 14, 30),
      imageKey: 'k2',
      imageContentType: 'image/png',
    });

    const list = (await Query.currentTortillas(null, {}, user)) as Array<{
      name: string;
    }>;
    expect(list).toHaveLength(2);
    expect(list.map((tortilla) => tortilla.name).sort()).toEqual([
      'De calabacín',
      'De patata',
    ]);
  });

  it('excluye las de días anteriores', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    await Tortilla.create({
      name: 'Vieja',
      date: new Date(2026, 5, 3),
      imageKey: 'k0',
      imageContentType: 'image/png',
    });
    await Tortilla.create({
      name: 'De hoy',
      date: new Date(2026, 5, 10),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });

    const list = (await Query.currentTortillas(null, {}, user)) as Array<{
      name: string;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('De hoy');
  });

  it('excluye la cerrada a mano pero conserva la otra del día', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    await Tortilla.create({
      name: 'Abierta',
      date: new Date(2026, 5, 10, 12, 0),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
    await Tortilla.create({
      name: 'Cerrada',
      date: new Date(2026, 5, 10, 14, 0),
      imageKey: 'k2',
      imageContentType: 'image/png',
      closedAt: new Date(),
    });

    const list = (await Query.currentTortillas(null, {}, user)) as Array<{
      name: string;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Abierta');
  });

  it('sin tortillas devuelve lista vacía', async () => {
    const { ctx: user } = await makeUser('pepe', 'user');
    const list = (await Query.currentTortillas(null, {}, user)) as unknown[];
    expect(list).toEqual([]);
  });
});

describe('alergias: guardado y visibilidad en la convocatoria', () => {
  type AttendeeOut = {
    userName: string;
    allergens: string[] | null;
    allergyNotes: string | null;
  };
  type EventOut = { id: string; attendees: AttendeeOut[] };

  /** Admin convoca; Ana (celiaca) se apunta. Devuelve los ctx y el id. */
  async function setup() {
    const { ctx: admin } = await makeUser('jefa', 'admin');
    const { ctx: ana } = await makeUser('ana', 'user');
    const { ctx: curioso } = await makeUser('curioso', 'user');
    await Mutation.setAllergies(
      null,
      { input: { allergens: ['milk', 'gluten'], allergyNotes: '  kiwi  ' } },
      ana
    );
    const event = (await Mutation.announceTortilla(
      null,
      { input: {} },
      admin
    )) as EventOut;
    await Mutation.setAttendance(null, { id: event.id, attending: true }, ana);
    return { admin, ana, curioso };
  }

  it('setAllergies normaliza orden, observaciones y lo devuelve en me', async () => {
    const { ctx: ana } = await makeUser('ana', 'user');
    await Mutation.setAllergies(
      null,
      { input: { allergens: ['milk', 'gluten', 'milk'], allergyNotes: ' kiwi ' } },
      ana
    );
    const me = (await Query.me(null, {}, ana)) as {
      allergens: string[];
      allergyNotes: string | null;
    };
    expect(me.allergens).toEqual(['gluten', 'milk']);
    expect(me.allergyNotes).toBe('kiwi');
  });

  it('setAllergies con lista vacía y notas vacías lo borra todo', async () => {
    const { ctx: ana } = await makeUser('ana', 'user');
    await Mutation.setAllergies(
      null,
      { input: { allergens: ['eggs'], allergyNotes: 'kiwi' } },
      ana
    );
    await Mutation.setAllergies(
      null,
      { input: { allergens: [], allergyNotes: '' } },
      ana
    );
    const me = (await Query.me(null, {}, ana)) as {
      allergens: string[];
      allergyNotes: string | null;
    };
    expect(me.allergens).toEqual([]);
    expect(me.allergyNotes).toBeNull();
  });

  it('setAllergies rechaza alérgenos desconocidos y exige sesión', async () => {
    const { ctx: ana } = await makeUser('ana', 'user');
    await expect(
      Mutation.setAllergies(
        null,
        { input: { allergens: ['chocolate'] } },
        ana
      )
    ).rejects.toThrow(/no válido/i);
    await expect(
      Mutation.setAllergies(null, { input: { allergens: [] } }, { session: null })
    ).rejects.toThrow(/sesión/i);
  });

  it('el admin ve las alergias de los apuntados', async () => {
    const { admin } = await setup();
    const event = (await Query.upcomingTortilla(null, {}, admin)) as EventOut;
    expect(event.attendees[0]).toMatchObject({
      userName: 'ana',
      allergens: ['gluten', 'milk'],
      allergyNotes: 'kiwi',
    });
  });

  it('un apuntado ve las alergias del resto de apuntados', async () => {
    const { admin, curioso } = await setup();
    const event = (await Query.upcomingTortilla(null, {}, admin)) as EventOut;
    await Mutation.setAttendance(
      null,
      { id: event.id, attending: true },
      curioso
    );
    const seen = (await Query.upcomingTortilla(null, {}, curioso)) as EventOut;
    const ana = seen.attendees.find((a) => a.userName === 'ana');
    expect(ana?.allergens).toEqual(['gluten', 'milk']);
  });

  it('quien no está apuntado ni es admin recibe null (no "sin alergias")', async () => {
    const { curioso } = await setup();
    const seen = (await Query.upcomingTortilla(null, {}, curioso)) as EventOut;
    expect(seen.attendees[0].allergens).toBeNull();
    expect(seen.attendees[0].allergyNotes).toBeNull();
  });

  it('sin sesión tampoco se ven', async () => {
    await setup();
    const seen = (await Query.upcomingTortilla(null, {}, { session: null })) as EventOut;
    expect(seen.attendees[0].allergens).toBeNull();
  });

  it('el rol de admin se lee de la BD, no de la sesión', async () => {
    const { curioso } = await setup();
    // Sesión que dice "admin" pero en BD es un usuario normal.
    const forged = {
      session: { user: { ...curioso.session.user, role: 'admin' } },
    };
    const seen = (await Query.upcomingTortilla(null, {}, forged)) as EventOut;
    expect(seen.attendees[0].allergens).toBeNull();
  });
});

describe('changeNickname', () => {
  /** Ana vota una tortilla y comenta; devuelve su ctx y la tortilla. */
  async function anaWithHistory() {
    const { ctx: ana, doc } = await makeUser('Ana');
    const tortilla = await Tortilla.create({
      name: 'De patata',
      date: new Date(2026, 5, 10),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
    const tortillaId = tortilla._id.toString();
    await Mutation.castVote(null, { input: { tortillaId, score: 8 } }, ana);
    await Mutation.addComment(
      null,
      { input: { tortillaId, text: 'Buenísima' } },
      ana
    );
    return { ana, doc, tortilla };
  }

  function change(ctx: unknown, username: string) {
    return Mutation.changeNickname(null, { username }, ctx) as Promise<{
      username: string;
      nicknameChangesLeft: number;
    }>;
  }

  it('cambia el nombre y descuenta un cambio', async () => {
    const { ctx } = await makeUser('Ana');
    const me = await change(ctx, 'Anita');
    expect(me).toMatchObject({ username: 'Anita', nicknameChangesLeft: 2 });

    const saved = await User.findOne({ usernameKey: 'anita' }).exec();
    expect(saved?.username).toBe('Anita');
    expect(await User.findOne({ usernameKey: 'ana' }).exec()).toBeNull();
  });

  it('conserva votos, comentarios y estadísticas', async () => {
    const { ana } = await anaWithHistory();
    await change(ana, 'Anita');

    const stats = (await Query.myStats(null, {}, ana)) as {
      username: string;
      totalVotes: number;
      averageGiven: number;
    };
    expect(stats).toMatchObject({
      username: 'Anita',
      totalVotes: 1,
      averageGiven: 8,
    });
  });

  it('actualiza el nombre mostrado en votos, comentarios y apuntados', async () => {
    const { ana } = await anaWithHistory();
    const { ctx: admin } = await makeUser('jefa', 'admin');
    const event = (await Mutation.announceTortilla(
      null,
      { input: {} },
      admin
    )) as { id: string };
    await Mutation.setAttendance(null, { id: event.id, attending: true }, ana);

    await change(ana, 'Anita');

    expect((await Vote.findOne({ userKey: 'anita' }).exec())?.userName).toBe(
      'Anita'
    );
    expect((await Comment.findOne({ userKey: 'anita' }).exec())?.userName).toBe(
      'Anita'
    );
    const seen = (await Query.upcomingTortilla(null, {}, admin)) as {
      attendees: { userName: string }[];
    };
    expect(seen.attendees.map((a) => a.userName)).toContain('Anita');
  });

  it('permite 3 cambios y rechaza el cuarto', async () => {
    const { ctx } = await makeUser('Ana');
    expect((await change(ctx, 'Ana2')).nicknameChangesLeft).toBe(2);
    expect((await change(ctx, 'Ana3')).nicknameChangesLeft).toBe(1);
    expect((await change(ctx, 'Ana4')).nicknameChangesLeft).toBe(0);
    await expect(change(ctx, 'Ana5')).rejects.toThrow(/no te quedan/i);
    // Y el nombre no se ha tocado.
    expect(await User.findOne({ usernameKey: 'ana4' }).exec()).not.toBeNull();
  });

  it('corregir mayúsculas no gasta cambios ni con el cupo agotado', async () => {
    const { ctx } = await makeUser('ana');
    await change(ctx, 'Ana2');
    await change(ctx, 'Ana3');
    await change(ctx, 'Ana4');
    const me = await change(ctx, 'ANA4');
    expect(me).toMatchObject({ username: 'ANA4', nicknameChangesLeft: 0 });
  });

  it('rechaza un nombre que ya tiene otra persona', async () => {
    const { ctx } = await makeUser('Ana');
    await makeUser('Vic');
    await expect(change(ctx, 'vic')).rejects.toThrow(/ya está cogido/i);
  });

  it('exige sesión y valida el formato', async () => {
    const { ctx } = await makeUser('Ana');
    await expect(
      Mutation.changeNickname(null, { username: 'X' }, { session: null })
    ).rejects.toThrow(/sesión/i);
    await expect(change(ctx, 'x')).rejects.toThrow(/entre 2 y 20/i);
  });

  it('quien coge el nombre libre no hereda el historial del anterior', async () => {
    const { ana } = await anaWithHistory();
    await change(ana, 'Anita');

    // Otra persona se registra con el nombre que Ana ha dejado libre.
    await Mutation.register(
      null,
      {
        input: {
          username: 'Ana',
          email: 'otra@test.dev',
          password: 'password1',
        },
      },
      { session: null }
    );
    const suplantadora = await User.findOne({ usernameKey: 'ana' }).exec();
    const ctx = {
      session: {
        user: {
          id: suplantadora!._id.toString(),
          username: 'Ana',
          usernameKey: 'ana',
          email: 'otra@test.dev',
          needsUsername: false,
          role: 'user',
        },
      },
    };
    const stats = (await Query.myStats(null, {}, ctx)) as { totalVotes: number };
    expect(stats.totalVotes).toBe(0);
    // Y el voto sigue siendo de Ana (ahora Anita).
    const vote = await Vote.findOne({}).exec();
    expect(vote?.user?.toString()).not.toBe(suplantadora!._id.toString());
  });

  it('al registrarse sí se recuperan los votos previos sin cuenta', async () => {
    const tortilla = await Tortilla.create({
      name: 'Vieja',
      date: new Date(2026, 0, 1),
      imageKey: 'k0',
      imageContentType: 'image/png',
    });
    // Voto histórico: solo nombre, sin cuenta (como los del Excel).
    await Vote.create({
      tortilla: tortilla._id,
      userKey: 'legacy',
      userName: 'Legacy',
      score: 7,
    });

    await Mutation.register(
      null,
      {
        input: {
          username: 'Legacy',
          email: 'legacy@test.dev',
          password: 'password1',
        },
      },
      { session: null }
    );

    const user = await User.findOne({ usernameKey: 'legacy' }).exec();
    const vote = await Vote.findOne({ userKey: 'legacy' }).exec();
    expect(vote?.user?.toString()).toBe(user!._id.toString());

    const stats = (await Query.userStats(
      null,
      { username: 'Legacy' },
      { session: null }
    )) as { totalVotes: number };
    expect(stats.totalVotes).toBe(1);
  });

  it('userStats encuentra a quien votó sin llegar a registrarse', async () => {
    const tortilla = await Tortilla.create({
      name: 'Vieja',
      date: new Date(2026, 0, 1),
      imageKey: 'k0',
      imageContentType: 'image/png',
    });
    await Vote.create({
      tortilla: tortilla._id,
      userKey: 'fantasma',
      userName: 'Fantasma',
      score: 5,
    });
    const stats = (await Query.userStats(
      null,
      { username: 'Fantasma' },
      { session: null }
    )) as { username: string; totalVotes: number };
    expect(stats).toMatchObject({ username: 'Fantasma', totalVotes: 1 });
  });
});

describe('avisos de logros nuevos', () => {
  type Item = { id: string };
  const ids = (list: unknown) => (list as Item[]).map((a) => a.id);

  async function votableTortilla() {
    return Tortilla.create({
      name: 'De patata',
      date: new Date(2026, 5, 10),
      imageKey: 'k1',
      imageContentType: 'image/png',
    });
  }

  it('sin sesión devuelve vacío', async () => {
    expect(await Query.newAchievements(null, {}, { session: null })).toEqual([]);
  });

  it('la primera consulta fija la línea base sin celebrar lo que ya tenía', async () => {
    const { doc, ctx } = await makeUser('pepe');
    const t = await votableTortilla();
    await Mutation.castVote(
      null,
      { input: { tortillaId: t._id.toString(), score: 10 } },
      ctx
    );

    expect(await Query.newAchievements(null, {}, ctx)).toEqual([]);
    const user = await User.findById(doc._id).lean();
    expect(user?.seenAchievements).toEqual(
      expect.arrayContaining(['firstVote', 'perfectScore'])
    );
    // Y ya no hay nada pendiente.
    expect(await Query.newAchievements(null, {}, ctx)).toEqual([]);
  });

  it('devuelve lo desbloqueado después hasta que se marca como visto', async () => {
    const { ctx } = await makeUser('pepe');
    expect(await Query.newAchievements(null, {}, ctx)).toEqual([]);

    const t = await votableTortilla();
    await Mutation.castVote(
      null,
      { input: { tortillaId: t._id.toString(), score: 7 } },
      ctx
    );

    const fresh = ids(await Query.newAchievements(null, {}, ctx));
    expect(fresh).toContain('firstVote');
    expect(fresh).not.toContain('perfectScore');

    await Mutation.markAchievementsSeen(
      null,
      { ids: [...fresh, 'inventado'] },
      ctx
    );
    expect(await Query.newAchievements(null, {}, ctx)).toEqual([]);
  });

  it('markAchievementsSeen ignora ids desconocidos y exige sesión', async () => {
    const { doc, ctx } = await makeUser('pepe');
    await Mutation.markAchievementsSeen(
      null,
      { ids: ['firstVote', 'firstVote', 'hackeado'] },
      ctx
    );
    const user = await User.findById(doc._id).lean();
    expect(user?.seenAchievements).toEqual(['firstVote']);

    await expect(
      Mutation.markAchievementsSeen(null, { ids: ['firstVote'] }, { session: null })
    ).rejects.toThrow(/sesión/i);
  });
});

describe('cumpleaños', () => {
  it('register guarda el cumpleaños opcional y lo valida', async () => {
    await Mutation.register(
      null,
      {
        input: {
          username: 'Ana',
          email: 'ana@test.dev',
          password: '12345678',
          birthday: { day: 14, month: 10 },
        },
      },
      {}
    );
    const ana = await User.findOne({ usernameKey: 'ana' }).lean();
    expect(ana?.birthday).toEqual({ day: 14, month: 10 });

    await Mutation.register(
      null,
      { input: { username: 'Sin', email: 'sin@test.dev', password: '12345678' } },
      {}
    );
    const sin = await User.findOne({ usernameKey: 'sin' }).lean();
    expect(sin?.birthday).toBeUndefined();

    await expect(
      Mutation.register(
        null,
        {
          input: {
            username: 'Mal',
            email: 'mal@test.dev',
            password: '12345678',
            birthday: { day: 30, month: 2 },
          },
        },
        {}
      )
    ).rejects.toThrow(/día/);
    expect(await User.findOne({ usernameKey: 'mal' })).toBeNull();
  });

  it('setBirthday lo cambia y con null lo borra', async () => {
    const { doc, ctx } = await makeUser('pepe');
    const saved = (await Mutation.setBirthday(
      null,
      { birthday: { day: 3, month: 7 } },
      ctx
    )) as { birthday: unknown };
    expect(saved.birthday).toEqual({ day: 3, month: 7 });

    const me = (await Query.me(null, {}, ctx)) as { birthday: unknown };
    expect(me.birthday).toEqual({ day: 3, month: 7 });

    await Mutation.setBirthday(null, { birthday: null }, ctx);
    const user = await User.findById(doc._id).lean();
    expect(user?.birthday).toBeUndefined();

    await expect(
      Mutation.setBirthday(null, { birthday: { day: 3 } }, { session: null })
    ).rejects.toThrow(/sesión/i);
  });

  describe('birthdaysToday', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function withBirthday(name: string, day: number, month: number) {
      const { doc } = await makeUser(name);
      await User.updateOne({ _id: doc._id }, { $set: { birthday: { day, month } } });
    }

    it('devuelve solo a quien cumple hoy en Madrid', async () => {
      await withBirthday('Ana', 14, 10);
      await withBirthday('Luis', 13, 10);
      await makeUser('Pepe');
      // 23:30 UTC del 13 = ya es 14 en Madrid.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 13, 23, 30)));

      expect(await Query.birthdaysToday(null, {}, {})).toEqual(['Ana']);
    });

    it('el 28 de febrero no bisiesto incluye a quien nació el 29', async () => {
      await withBirthday('Bisi', 29, 2);
      await withBirthday('Normal', 28, 2);
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(Date.UTC(2027, 1, 28, 12)));

      const names = (await Query.birthdaysToday(null, {}, {})) as string[];
      expect(names.sort()).toEqual(['Bisi', 'Normal']);
    });
  });
});

describe('ranking', () => {
  it('agrupa por cuenta, pone el nombre actual y cuenta los votos históricos', async () => {
    const { doc: ana } = await makeUser('Ana');
    const tortillas = await Promise.all(
      [3, 10, 17, 24, 31].map((d) =>
        Tortilla.create({
          name: `T${d}`,
          date: new Date(2026, 6, d),
          imageKey: `k${d}`,
          imageContentType: 'image/png',
        })
      )
    );
    // Ana vota las cinco con su cuenta; un votante histórico sin cuenta, tres.
    await Vote.insertMany([
      ...tortillas.map((t, i) => ({
        tortilla: t._id,
        user: ana._id,
        userName: 'ana-antes',
        userKey: 'ana-antes',
        score: 8 + (i % 2),
      })),
      ...tortillas.slice(0, 3).map((t) => ({
        tortilla: t._id,
        userName: 'Viejo',
        userKey: 'viejo',
        score: 4,
      })),
    ]);

    const ranking = (await Query.ranking(null, {}, {})) as {
      mostVotes: { userName: string; value: number }[];
      generous: { userName: string }[];
      bestTortillas: { tortilla: { name: string } }[];
    };

    // El nombre sale de la cuenta, no del voto (que tenía el antiguo).
    expect(ranking.mostVotes).toEqual([
      expect.objectContaining({ userName: 'Ana', value: 5 }),
      expect.objectContaining({ userName: 'Viejo', value: 3 }),
    ]);
    // Viejo no llega al mínimo de votos para las medias.
    expect(ranking.generous.map((v) => v.userName)).toEqual(['Ana']);
    // Las tres primeras tienen 2 votos: ninguna llega al mínimo de 3.
    expect(ranking.bestTortillas).toEqual([]);
  });
});
