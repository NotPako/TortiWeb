import { GraphQLScalarType, Kind } from 'graphql';
import { tortillaFields, tortillaMutations, tortillaQueries } from './tortillas';
import { commentMutations } from './comments';
import { eventMutations, eventQueries } from './events';
import { userFields, userMutations, userQueries } from './users';
import { groupFields, groupMutations, groupQueries } from './groups';

export type { GqlContext } from './context';

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Fecha en formato ISO 8601',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  },
});

/**
 * Resolvers agrupados por dominio. La autorización por grupo vive en
 * `./access.ts`; ver allí el invariante que todos deben cumplir.
 */
export const resolvers = {
  Date: dateScalar,

  Query: {
    ...groupQueries,
    ...tortillaQueries,
    ...eventQueries,
    ...userQueries,
  },

  Mutation: {
    ...groupMutations,
    ...tortillaMutations,
    ...commentMutations,
    ...eventMutations,
    ...userMutations,
  },

  Tortilla: tortillaFields,
  Group: groupFields,
  User: userFields,
};
