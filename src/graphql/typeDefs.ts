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
    """Fecha en que el admin cerró la votación manualmente (null si no se cerró)."""
    closedAt: Date
    """True si todavía se puede votar (mismo día y sin cierre manual)."""
    votingOpen: Boolean!
    comments: [Comment!]!
  }

  """Comentario de un usuario sobre una tortilla."""
  type Comment {
    id: ID!
    userName: String!
    text: String!
    createdAt: Date!
    """URL del avatar del autor, si está disponible."""
    imageUrl: String
    """True si el comentario lo escribió el usuario autenticado (puede borrarlo)."""
    isMine: Boolean!
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

  """Persona apuntada a una convocatoria."""
  type Attendee {
    userName: String!
    """URL del avatar del apuntado, si está disponible."""
    imageUrl: String
  }

  """
  Convocatoria de la próxima tortilla (antes de cocinarse). La gente se apunta
  para que el chef sepa cuántos ingredientes preparar.
  """
  type TortillaEvent {
    id: ID!
    """Miércoles previsto."""
    date: Date!
    """Nota opcional del admin (p. ej. "traed pan")."""
    note: String
    attendees: [Attendee!]!
    attendeeCount: Int!
    """True si el usuario autenticado está apuntado."""
    isAttending: Boolean!
    """Fecha de cierre (auto al subir la tortilla o manual). Null si sigue abierta."""
    closedAt: Date
    """True si la convocatoria sigue abierta para apuntarse."""
    open: Boolean!
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
    """Lista de logros (siempre completa: incluye desbloqueados y bloqueados)."""
    achievements: [Achievement!]!
  }

  """Logro desbloqueable por el usuario."""
  type Achievement {
    """Identificador estable para el frontend (clave i18n y emoji)."""
    id: String!
    """Emoji representativo."""
    emoji: String!
    unlocked: Boolean!
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
    """Convocatoria abierta de la próxima tortilla, o null si no hay ninguna."""
    upcomingTortilla: TortillaEvent
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

  input AddCommentInput {
    tortillaId: ID!
    text: String!
  }

  input AnnounceTortillaInput {
    """Fecha del miércoles; si no se indica, se usa el próximo miércoles."""
    date: Date
    """Nota opcional para los apuntados."""
    note: String
  }

  type Mutation {
    createTortilla(input: CreateTortillaInput!): Tortilla!
    castVote(input: CastVoteInput!): Vote!
    """Elimina una tortilla y todos sus votos. Requiere rol de admin."""
    deleteTortilla(id: ID!): Boolean!
    """Cierra manualmente la votación de una tortilla. Requiere rol de admin."""
    closeTortillaVoting(id: ID!): Tortilla!
    """Crea una cuenta con usuario+contraseña. Devuelve el usuario."""
    register(input: RegisterInput!): User!
    """Asigna un username a un usuario autenticado por Google sin username."""
    setUsername(username: String!): User!
    """Sube y asigna una foto de perfil al usuario autenticado."""
    setProfileImage(input: SetProfileImageInput!): User!
    """Añade un comentario a una tortilla. Requiere sesión."""
    addComment(input: AddCommentInput!): Comment!
    """Elimina un comentario propio."""
    deleteComment(id: ID!): Boolean!
    """Convoca la tortilla del próximo miércoles. Requiere rol de admin."""
    announceTortilla(input: AnnounceTortillaInput!): TortillaEvent!
    """Cierra manualmente una convocatoria. Requiere rol de admin."""
    closeTortillaEvent(id: ID!): TortillaEvent!
    """Apunta o desapunta al usuario autenticado de una convocatoria."""
    setAttendance(id: ID!, attending: Boolean!): TortillaEvent!
  }
`;
