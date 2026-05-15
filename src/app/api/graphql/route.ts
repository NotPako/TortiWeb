import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { typeDefs } from '@/graphql/typeDefs';
import { resolvers, type GqlContext } from '@/graphql/resolvers';
import { authOptions } from '@/lib/auth';

const server = new ApolloServer<GqlContext>({
  typeDefs,
  resolvers,
  introspection: true,
});

const handler = startServerAndCreateNextHandler<NextRequest, GqlContext>(
  server,
  {
    context: async () => {
      const session = await getServerSession(authOptions);
      return { session };
    },
  }
);

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

export const maxDuration = 30;
