import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { NextRequest } from 'next/server';

import { typeDefs } from '@/graphql/typeDefs';
import { resolvers } from '@/graphql/resolvers';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => ({ req }),
});

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

// Permitimos cuerpos de petición de hasta 10MB para subir imágenes en base64.
export const maxDuration = 30;
