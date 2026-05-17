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

  enum Reaction {
    fire
    yummy
    meh
    cringe
  }

  """Voto de un usuario sobre una tortilla."""
  type Vote {
    id: ID!
    userName: String!
    score: Float!
    reaction: Reaction
    createdAt: Date!
    """URL del avatar del votante, si está disponible."""
    imageUrl: String
  }

  """Usuario autenticado."""
  type User {
    id: ID!
    username: String!
    email: String!
    """URL del avatar (subido por el usuario o externo de Google)."""
    imageUrl: String
  }

  """Resumen de tortilla para el perfil de usuario."""
  type TortillaSummary {
    id: ID!
    name: String!
    date: Date!
    imageUrl: String!
  }

  """Voto personal con información de la tortilla."""
  type PersonalVote {
    id: ID!
    score: Float!
    reaction: Reaction
    createdAt: Date!
    tortilla: TortillaSummary!
  }

  """Estadísticas personales de un usuario."""
  type UserStats {
    """Nombre del usuario (preserva mayúsculas/minúsculas del registro original)."""
    username: String!
    """URL del avatar del usuario, si está disponible."""
    imageUrl: String
    totalVotes: Int!
    averageGiven: Float
    """Tortillas consecutivas votadas hasta la fecha (sin contar la de hoy si aún no se votó)."""
    currentStreak: Int!
    """Mejor racha histórica de tortillas consecutivas votadas."""
    bestStreak: Int!
    bestVote: PersonalVote
    votes: [PersonalVote!]!
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
    """Estadísticas y votos del usuario autenticado."""
    myStats: UserStats
    """Estadísticas y votos de cualquier usuario por nombre de usuario."""
    userStats(username: String!): UserStats
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
    reaction: Reaction
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
  }

  input SetProfileImageInput {
    """Imagen en base64 (data URL o cadena pura)."""
    imageBase64: String!
    """Tipo MIME de la imagen, ej. image/jpeg."""
    imageContentType: String!
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
    """Sube y asigna una foto de perfil al usuario autenticado."""
    setProfileImage(input: SetProfileImageInput!): User!
  }
`;
