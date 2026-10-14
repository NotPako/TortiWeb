import { describe, it, expect } from 'vitest';
import { buildASTSchema } from 'graphql';
import { typeDefs } from './typeDefs';

describe('typeDefs', () => {
  // Los resolvers se prueban llamándolos directamente: sin esto, un error de
  // sintaxis en el esquema solo se vería al arrancar el servidor.
  it('es un esquema GraphQL válido', () => {
    expect(() => buildASTSchema(typeDefs)).not.toThrow();
  });
});
