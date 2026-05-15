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

  """Usuario autenticado."""
  type User {
    id: ID!
    username: String!
    email: String!
  }

  type Query {
    """Lista de todas las tortillas, ordenadas por fecha descendente."""
    tortillas: [Tortilla!]!
    """Una tortilla concreta por ID."""
    tortilla(id: ID!): Tortilla
    """La tortilla más reciente (la del miércoles actual)."""
    currentTortilla: Tortilla
    """Información del usuario autenticado, o null si no hay sesión."""
    me: User
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
    score: Float!
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
  }

  type Mutation {
    createTortilla(input: CreateTortillaInput!): Tortilla!
    castVote(input: CastVoteInput!): Vote!
    """Elimina una tortilla y todos sus votos. Requiere contraseña de admin."""
    deleteTortilla(id: ID!, adminPassword: String!): Boolean!
    """Crea una cuenta con usuario+contraseña. Devuelve el usuario."""
    register(input: RegisterInput!): User!
    """Asigna un username a un usuario autenticado por Google sin username."""
    setUsername(username: String!): User!
  }
`;
