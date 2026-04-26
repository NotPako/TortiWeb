import gql from 'graphql-tag';

export const typeDefs = gql`
  scalar Date

  """Tortilla cocinada un miércoles."""
  type Tortilla {
    id: ID!
    name: String!
    description: String
    date: Date!
    imageUrl: String!
    averageScore: Float
    voteCount: Int!
    votes: [Vote!]!
    myVote: Vote
  }

  """Voto de un usuario sobre una tortilla."""
  type Vote {
    id: ID!
    userName: String!
    score: Float!
    createdAt: Date!
  }

  type Query {
    """Lista de todas las tortillas, ordenadas por fecha descendente."""
    tortillas(userName: String): [Tortilla!]!
    """Una tortilla concreta por ID."""
    tortilla(id: ID!, userName: String): Tortilla
    """La tortilla más reciente (la del miércoles actual)."""
    currentTortilla(userName: String): Tortilla
  }

  input CreateTortillaInput {
    name: String!
    description: String
    """Imagen en base64 (data URL o cadena pura)."""
    imageBase64: String!
    """Tipo MIME de la imagen, ej. image/jpeg."""
    imageContentType: String!
    """Fecha opcional; si no se indica, se usa la actual."""
    date: Date
    """Contraseña de admin requerida para crear tortillas."""
    adminPassword: String!
  }

  input CastVoteInput {
    tortillaId: ID!
    userName: String!
    score: Float!
  }

  type Mutation {
    createTortilla(input: CreateTortillaInput!): Tortilla!
    castVote(input: CastVoteInput!): Vote!
  }
`;
