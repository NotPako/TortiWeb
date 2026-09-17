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

  """
  Alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011), más las
  nueces por separado. Debe coincidir con ALLERGENS de src/lib/allergens.ts.
  """
  enum Allergen {
    gluten
    crustaceans
    eggs
    fish
    peanuts
    soy
    milk
    nuts
    walnuts
    celery
    mustard
    sesame
    sulphites
    lupin
    molluscs
  }

  """Persona apuntada a una convocatoria."""
  type Attendee {
    userName: String!
    """URL del avatar del apuntado, si está disponible."""
    imageUrl: String
    """
    Alérgenos del apuntado. Solo visible para los admins del grupo y para quien
    esté apuntado a la misma convocatoria; null para el resto (no significa
    "sin alergias").
    """
    allergens: [Allergen!]
    """Observaciones libres sobre alergias. Misma visibilidad que allergens."""
    allergyNotes: String
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

  """Rol dentro de un grupo. Se puede ser admin de uno y miembro de otro."""
  enum GroupRole {
    member
    admin
  }

  """
  Grupo (peña): tortillas, votos, comentarios y convocatorias aislados del
  resto de grupos. Solo lo ven sus miembros.
  """
  type Group {
    id: ID!
    name: String!
    """Identificador en la URL (/g/<slug>)."""
    slug: String!
    description: String
    """Rol del usuario autenticado en este grupo."""
    myRole: GroupRole!
    isAdmin: Boolean!
    memberCount: Int!
    """Miembros por orden de llegada."""
    members: [GroupMember!]!
    """Invitaciones del grupo (más recientes primero). Null si no eres admin."""
    invites: [GroupInvite!]
  }

  type GroupMember {
    userName: String!
    imageUrl: String
    role: GroupRole!
    joinedAt: Date!
    """True si es el usuario autenticado."""
    isMe: Boolean!
  }

  enum InviteStatus {
    active
    revoked
    expired
    exhausted
  }

  type GroupInvite {
    id: ID!
    """Código para el enlace /join/<code> o para dictarlo."""
    code: String!
    createdAt: Date!
    """Null = no caduca."""
    expiresAt: Date
    """Null = usos ilimitados."""
    maxUses: Int
    uses: Int!
    revokedAt: Date
    status: InviteStatus!
  }

  """Lo que ve quien abre un enlace de invitación antes de aceptarlo."""
  type InvitePreview {
    groupName: String!
    groupSlug: String!
    status: InviteStatus!
    """True si ya es miembro: basta con llevarle al grupo."""
    alreadyMember: Boolean!
  }

  """Usuario autenticado."""
  type User {
    id: ID!
    username: String!
    email: String!
    """URL del avatar (subido por el usuario o externo de Google)."""
    imageUrl: String
    """Alérgenos que indicó el propio usuario. Solo se expone vía me."""
    allergens: [Allergen!]!
    """Observaciones libres sobre alergias del propio usuario."""
    allergyNotes: String
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

  """
  Todas las queries y mutations sobre tortillas, votos, comentarios y
  convocatorias exigen ser miembro del grupo. Para quien no lo es, el grupo y
  lo que contiene se comportan como si no existieran.
  """
  type Query {
    """Grupos del usuario autenticado, por nombre."""
    myGroups: [Group!]!
    """Un grupo por slug, o null si no existe o no eres miembro."""
    group(slug: String!): Group
    """Datos de una invitación por código, o null si no existe. Requiere sesión."""
    invitePreview(code: String!): InvitePreview
    """Tortillas del grupo, ordenadas por fecha descendente."""
    tortillas(groupSlug: String!): [Tortilla!]!
    """Una tortilla concreta por ID (null si es de un grupo ajeno)."""
    tortilla(id: ID!): Tortilla
    """
    Tortillas de la jornada en curso del grupo, abiertas a votación.
    Normalmente una, pero pueden ser varias si ese día se cocinó más de una.
    """
    currentTortillas(groupSlug: String!): [Tortilla!]!
    """Información del usuario autenticado, o null si no hay sesión."""
    me: User
    """Estadísticas del usuario autenticado dentro del grupo."""
    myStats(groupSlug: String!): UserStats
    """
    Estadísticas de un usuario dentro del grupo. Null si nunca ha sido miembro
    ni ha votado en él.
    """
    userStats(groupSlug: String!, username: String!): UserStats
    """Convocatoria abierta del grupo, o null si no hay ninguna."""
    upcomingTortilla(groupSlug: String!): TortillaEvent
  }

  input CreateTortillaInput {
    groupSlug: String!
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

  input SetAllergiesInput {
    """Lista completa (sustituye a la anterior). Vacía = sin alergias."""
    allergens: [Allergen!]!
    """Observaciones libres; vacío o null las borra."""
    allergyNotes: String
  }

  input CreateGroupInput {
    name: String!
    description: String
  }

  input CreateInviteInput {
    groupSlug: String!
    """Días hasta que caduca (1-90). Null = no caduca."""
    expiresInDays: Int
    """Usos máximos (1-100). Null = ilimitados."""
    maxUses: Int
  }

  input AnnounceTortillaInput {
    groupSlug: String!
    """Fecha del miércoles; si no se indica, se usa el próximo miércoles."""
    date: Date
    """Nota opcional para los apuntados."""
    note: String
  }

  type Mutation {
    """Crea un grupo; quien lo crea queda como admin."""
    createGroup(input: CreateGroupInput!): Group!
    """Crea una invitación. Requiere ser admin del grupo."""
    createInvite(input: CreateInviteInput!): GroupInvite!
    """Revoca una invitación (no se borra). Requiere ser admin del grupo."""
    revokeInvite(id: ID!): GroupInvite!
    """Canjea una invitación. Idempotente si ya eres miembro."""
    redeemInvite(code: String!): Group!
    """Cambia el rol de un miembro. Un grupo nunca se queda sin admins."""
    setMemberRole(groupSlug: String!, userName: String!, role: GroupRole!): GroupMember!
    """Expulsa a un miembro. Sus votos y comentarios se conservan."""
    removeMember(groupSlug: String!, userName: String!): Boolean!
    """Sale del grupo. El último admin no puede salir."""
    leaveGroup(groupSlug: String!): Boolean!
    """Sube una tortilla al grupo. Requiere ser admin del grupo."""
    createTortilla(input: CreateTortillaInput!): Tortilla!
    castVote(input: CastVoteInput!): Vote!
    """Elimina una tortilla y todos sus votos. Requiere ser admin de su grupo."""
    deleteTortilla(id: ID!): Boolean!
    """Cierra manualmente la votación de una tortilla. Requiere ser admin de su grupo."""
    closeTortillaVoting(id: ID!): Tortilla!
    """Crea una cuenta con usuario+contraseña. Devuelve el usuario."""
    register(input: RegisterInput!): User!
    """Asigna un username a un usuario autenticado por Google sin username."""
    setUsername(username: String!): User!
    """Sube y asigna una foto de perfil al usuario autenticado."""
    setProfileImage(input: SetProfileImageInput!): User!
    """Guarda los alérgenos y observaciones del usuario autenticado."""
    setAllergies(input: SetAllergiesInput!): User!
    """Añade un comentario a una tortilla. Requiere sesión."""
    addComment(input: AddCommentInput!): Comment!
    """Elimina un comentario propio."""
    deleteComment(id: ID!): Boolean!
    """Convoca la tortilla del próximo miércoles. Requiere ser admin del grupo."""
    announceTortilla(input: AnnounceTortillaInput!): TortillaEvent!
    """Cierra manualmente una convocatoria. Requiere ser admin de su grupo."""
    closeTortillaEvent(id: ID!): TortillaEvent!
    """Apunta o desapunta al usuario autenticado de una convocatoria."""
    setAttendance(id: ID!, attending: Boolean!): TortillaEvent!
  }
`;
