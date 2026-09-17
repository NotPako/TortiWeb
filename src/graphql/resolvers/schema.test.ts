/**
 * Humo de extremo a extremo: esquema + resolvers montados en un ApolloServer
 * real. Detecta desajustes que los tests de resolvers sueltos no ven (un
 * argumento renombrado en typeDefs pero no en el resolver, un enum
 * incompatible, un resolver de campo que no existe en el esquema…).
 */
import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';

vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: async () => mongoose,
}));

vi.mock('@/lib/r2', () => ({
  getR2Client: () => ({ send: vi.fn().mockResolvedValue({}) }),
  getR2BucketName: () => 'test-bucket',
  getR2PublicUrl: () => null,
  publicUrlFor: () => null,
}));

import { typeDefs } from '@/graphql/typeDefs';
import { resolvers, type GqlContext } from './index';
import { makeUser, useMemoryDb } from './testing';

useMemoryDb();

describe('esquema GraphQL', () => {
  it('crea un grupo, invita y consulta miembros vía GraphQL', async () => {
    const server = new ApolloServer<GqlContext>({ typeDefs, resolvers });
    const ana = await makeUser('ana');
    const contextValue = ana.ctx as unknown as GqlContext;

    const created = await server.executeOperation(
      {
        query: `mutation($input: CreateGroupInput!) {
          createGroup(input: $input) { id slug isAdmin memberCount }
        }`,
        variables: { input: { name: 'Peña' } },
      },
      { contextValue }
    );
    expect(created.body.kind).toBe('single');
    if (created.body.kind !== 'single') return;
    expect(created.body.singleResult.errors).toBeUndefined();
    expect(created.body.singleResult.data).toEqual({
      createGroup: expect.objectContaining({
        slug: 'pena',
        isAdmin: true,
        memberCount: 1,
      }),
    });

    await server.executeOperation(
      {
        query: `mutation { createInvite(input: { groupSlug: "pena", maxUses: 3 }) { code status } }`,
      },
      { contextValue }
    );

    const detail = await server.executeOperation(
      {
        query: `query {
          group(slug: "pena") {
            myRole
            members { userName role isMe }
            invites { maxUses uses status }
          }
          tortillas(groupSlug: "pena") { id }
          currentTortillas(groupSlug: "pena") { id }
          upcomingTortilla(groupSlug: "pena") { id }
          myStats(groupSlug: "pena") { totalVotes }
        }`,
      },
      { contextValue }
    );
    if (detail.body.kind !== 'single') throw new Error('respuesta inesperada');
    expect(detail.body.singleResult.errors).toBeUndefined();
    expect(detail.body.singleResult.data).toMatchObject({
      group: {
        myRole: 'admin',
        members: [{ userName: 'ana', role: 'admin', isMe: true }],
        invites: [{ maxUses: 3, uses: 0, status: 'active' }],
      },
      tortillas: [],
      currentTortillas: [],
      upcomingTortilla: null,
      myStats: { totalVotes: 0 },
    });
  });
});
