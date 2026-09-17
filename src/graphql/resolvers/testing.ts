/**
 * Utilidades compartidas por los tests de resolvers. No es un test en sí.
 *
 * Cada fichero de test debe declarar antes sus `vi.mock` de `@/lib/mongodb` y
 * `@/lib/r2` (vitest solo los eleva dentro del propio fichero de test).
 */
import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { resolvers } from './index';
import { User } from '@/models/User';
import { Group, type GroupDocument } from '@/models/Group';
import { Membership } from '@/models/Membership';
import { Tortilla } from '@/models/Tortilla';
import type { GroupRole } from '@/lib/groups';

type AnyResolver = (parent: unknown, args: unknown, ctx: unknown) => unknown;
export const Query = resolvers.Query as unknown as Record<string, AnyResolver>;
export const Mutation = resolvers.Mutation as unknown as Record<
  string,
  AnyResolver
>;
export const GroupFields = resolvers.Group as unknown as Record<
  string,
  AnyResolver
>;

/** Levanta MongoDB en memoria para el fichero y vacía la BD tras cada test. */
export function useMemoryDb() {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    // Los índices únicos (membresía, slug, código) forman parte de lo que se
    // prueba: nos aseguramos de que existen antes de empezar.
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.syncIndexes())
    );
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
}

export const NO_SESSION = { session: null };

/** Crea un usuario y devuelve un ctx con su sesión. */
export async function makeUser(username: string) {
  const usernameKey = username.toLowerCase();
  const doc = await User.create({
    username,
    usernameKey,
    email: `${usernameKey}@test.dev`,
    emailKey: `${usernameKey}@test.dev`,
  });
  const ctx = {
    session: {
      user: {
        id: (doc._id as Types.ObjectId).toString(),
        username,
        usernameKey,
        email: `${usernameKey}@test.dev`,
        needsUsername: false,
      },
    },
  };
  return { doc, ctx, userKey: usernameKey, userName: username };
}

export type TestUser = Awaited<ReturnType<typeof makeUser>>;

export async function addMember(
  group: GroupDocument,
  user: TestUser,
  role: GroupRole = 'member'
) {
  return Membership.create({
    group: group._id,
    userKey: user.userKey,
    userName: user.userName,
    role,
  });
}

/** Crea un grupo con sus admins y miembros ya dentro. */
export async function makeGroup(
  slug: string,
  people: { admins?: TestUser[]; members?: TestUser[] } = {}
) {
  const admins = people.admins ?? [];
  const group = await Group.create({
    name: slug,
    slug,
    createdByKey: admins[0]?.userKey ?? 'test',
  });
  for (const admin of admins) await addMember(group, admin, 'admin');
  for (const member of people.members ?? []) await addMember(group, member);
  return group;
}

export async function makeTortilla(
  group: GroupDocument,
  fields: { name: string; date: Date; closedAt?: Date }
) {
  return Tortilla.create({
    group: group._id,
    imageKey: `k-${fields.name}`,
    imageContentType: 'image/png',
    ...fields,
  });
}

/** Input mínimo válido para `createTortilla` ("hello" en base64). */
export function tortillaInput(groupSlug: string, name = 'De patata') {
  return {
    input: {
      groupSlug,
      name,
      imageBase64: 'aGVsbG8=',
      imageContentType: 'image/png',
    },
  };
}
