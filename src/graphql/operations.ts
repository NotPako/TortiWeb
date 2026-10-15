import { gql } from '@apollo/client';

export const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      imageUrl
    }
  }
`;

export const GROUP_FIELDS = gql`
  fragment GroupFields on Group {
    id
    name
    slug
    description
    myRole
    isAdmin
    memberCount
  }
`;

export const MY_GROUPS_QUERY = gql`
  ${GROUP_FIELDS}
  query MyGroups {
    myGroups {
      ...GroupFields
    }
  }
`;

/** Lo usa la puerta de `/g/[slug]` y cualquier vista que necesite el rol. */
export const GROUP_QUERY = gql`
  ${GROUP_FIELDS}
  query Group($slug: String!) {
    group(slug: $slug) {
      ...GroupFields
    }
  }
`;

export const GROUP_INVITE_FIELDS = gql`
  fragment GroupInviteFields on GroupInvite {
    id
    code
    createdAt
    expiresAt
    maxUses
    uses
    revokedAt
    status
  }
`;

export const GROUP_MEMBERS_QUERY = gql`
  ${GROUP_INVITE_FIELDS}
  query GroupMembers($slug: String!) {
    group(slug: $slug) {
      id
      isAdmin
      memberCount
      members {
        userId
        userName
        imageUrl
        role
        joinedAt
        isMe
      }
      invites {
        ...GroupInviteFields
      }
    }
  }
`;

export const INVITE_PREVIEW_QUERY = gql`
  query InvitePreview($code: String!) {
    invitePreview(code: $code) {
      groupName
      groupSlug
      status
      alreadyMember
    }
  }
`;

export const CREATE_GROUP_MUTATION = gql`
  ${GROUP_FIELDS}
  mutation CreateGroup($input: CreateGroupInput!) {
    createGroup(input: $input) {
      ...GroupFields
    }
  }
`;

export const REDEEM_INVITE_MUTATION = gql`
  ${GROUP_FIELDS}
  mutation RedeemInvite($code: String!) {
    redeemInvite(code: $code) {
      ...GroupFields
    }
  }
`;

export const CREATE_INVITE_MUTATION = gql`
  ${GROUP_INVITE_FIELDS}
  mutation CreateInvite($input: CreateInviteInput!) {
    createInvite(input: $input) {
      ...GroupInviteFields
    }
  }
`;

export const REVOKE_INVITE_MUTATION = gql`
  ${GROUP_INVITE_FIELDS}
  mutation RevokeInvite($id: ID!) {
    revokeInvite(id: $id) {
      ...GroupInviteFields
    }
  }
`;

export const SET_MEMBER_ROLE_MUTATION = gql`
  mutation SetMemberRole(
    $groupSlug: String!
    $userId: ID!
    $role: GroupRole!
  ) {
    setMemberRole(groupSlug: $groupSlug, userId: $userId, role: $role) {
      userId
      role
    }
  }
`;

export const REMOVE_MEMBER_MUTATION = gql`
  mutation RemoveMember($groupSlug: String!, $userId: ID!) {
    removeMember(groupSlug: $groupSlug, userId: $userId)
  }
`;

export const LEAVE_GROUP_MUTATION = gql`
  mutation LeaveGroup($groupSlug: String!) {
    leaveGroup(groupSlug: $groupSlug)
  }
`;

export const TORTILLA_FIELDS = gql`
  fragment TortillaFields on Tortilla {
    id
    name
    description
    date
    imageUrl
    averageScore
    voteCount
    closedAt
    votingOpen
  }
`;

export const COMMENT_FIELDS = gql`
  fragment CommentFields on Comment {
    id
    userName
    text
    createdAt
    imageUrl
    isMine
  }
`;

export const CURRENT_TORTILLAS_QUERY = gql`
  ${TORTILLA_FIELDS}
  ${COMMENT_FIELDS}
  query CurrentTortillas($groupSlug: String!) {
    currentTortillas(groupSlug: $groupSlug) {
      ...TortillaFields
      myVote {
        id
        score
        reaction
      }
      comments {
        ...CommentFields
      }
    }
  }
`;

/** Solo fechas: para saber si la jornada de hoy ya pasó, sin traer votos. */
export const TORTILLA_DATES_QUERY = gql`
  query TortillaDates($groupSlug: String!) {
    tortillas(groupSlug: $groupSlug) {
      id
      date
    }
  }
`;

export const TORTILLAS_QUERY = gql`
  ${TORTILLA_FIELDS}
  query Tortillas($groupSlug: String!) {
    tortillas(groupSlug: $groupSlug) {
      ...TortillaFields
      myVote {
        id
        score
        reaction
      }
    }
  }
`;

export const TORTILLA_DETAIL_QUERY = gql`
  ${TORTILLA_FIELDS}
  ${COMMENT_FIELDS}
  query TortillaDetail($id: ID!) {
    tortilla(id: $id) {
      ...TortillaFields
      myVote {
        id
        score
        reaction
      }
      votes {
        id
        userName
        score
        reaction
        createdAt
        imageUrl
      }
      comments {
        ...CommentFields
      }
    }
  }
`;

export const CAST_VOTE_MUTATION = gql`
  mutation CastVote($input: CastVoteInput!) {
    castVote(input: $input) {
      id
      userName
      score
      reaction
      createdAt
    }
  }
`;

const USER_STATS_FIELDS = `
  username
  imageUrl
  totalVotes
  averageGiven
  currentStreak
  bestStreak
  bestVote {
    id
    score
    reaction
    createdAt
    tortilla {
      id
      name
      date
      imageUrl
    }
  }
  votes {
    id
    score
    reaction
    createdAt
    tortilla {
      id
      name
      date
      imageUrl
    }
  }
  achievements {
    id
    emoji
    unlocked
    progress
    goal
    hidden
  }
`;

export const MY_STATS_QUERY = gql`
  query MyStats($groupSlug: String!) {
    myStats(groupSlug: $groupSlug) {
      ${USER_STATS_FIELDS}
    }
  }
`;

export const NEW_ACHIEVEMENTS_QUERY = gql`
  query NewAchievements($groupSlug: String!) {
    newAchievements(groupSlug: $groupSlug) {
      id
      emoji
      unlocked
      hidden
    }
  }
`;

export const MARK_ACHIEVEMENTS_SEEN_MUTATION = gql`
  mutation MarkAchievementsSeen($groupSlug: String!, $ids: [String!]!) {
    markAchievementsSeen(groupSlug: $groupSlug, ids: $ids)
  }
`;

export const USER_STATS_QUERY = gql`
  query UserStats($groupSlug: String!, $username: String!) {
    userStats(groupSlug: $groupSlug, username: $username) {
      ${USER_STATS_FIELDS}
    }
  }
`;

export const CREATE_TORTILLA_MUTATION = gql`
  ${TORTILLA_FIELDS}
  mutation CreateTortilla($input: CreateTortillaInput!) {
    createTortilla(input: $input) {
      ...TortillaFields
    }
  }
`;

export const DELETE_TORTILLA_MUTATION = gql`
  mutation DeleteTortilla($id: ID!) {
    deleteTortilla(id: $id)
  }
`;

export const CLOSE_TORTILLA_VOTING_MUTATION = gql`
  ${TORTILLA_FIELDS}
  mutation CloseTortillaVoting($id: ID!) {
    closeTortillaVoting(id: $id) {
      ...TortillaFields
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      id
      username
      email
    }
  }
`;

export const SET_USERNAME_MUTATION = gql`
  mutation SetUsername($username: String!, $birthday: BirthdayInput) {
    setUsername(username: $username, birthday: $birthday) {
      id
      username
      email
    }
  }
`;

/**
 * Alergias del propio usuario. Query aparte de `ME_QUERY` a propósito: la
 * navbar consulta `me` en cada página y no tiene por qué traer datos de salud.
 */
export const MY_ALLERGIES_QUERY = gql`
  query MyAllergies {
    me {
      id
      allergens
      allergyNotes
    }
  }
`;

export const SET_ALLERGIES_MUTATION = gql`
  mutation SetAllergies($input: SetAllergiesInput!) {
    setAllergies(input: $input) {
      id
      allergens
      allergyNotes
    }
  }
`;

const RANKED_VOTER_FIELDS = `
  userName
  imageUrl
  value
  voteCount
`;

export const RANKING_QUERY = gql`
  query Ranking($groupSlug: String!) {
    ranking(groupSlug: $groupSlug) {
      year
      minVotesPerTortilla
      minVotesPerVoter
      bestTortillas {
        averageScore
        voteCount
        tortilla {
          id
          name
          date
          imageUrl
        }
      }
      toughest { ${RANKED_VOTER_FIELDS} }
      generous { ${RANKED_VOTER_FIELDS} }
      streaks { ${RANKED_VOTER_FIELDS} }
      mostVotes { ${RANKED_VOTER_FIELDS} }
    }
  }
`;

export const BIRTHDAYS_TODAY_QUERY = gql`
  query BirthdaysToday {
    birthdaysToday
  }
`;

export const MY_BIRTHDAY_QUERY = gql`
  query MyBirthday {
    me {
      id
      birthday {
        day
        month
      }
    }
  }
`;

export const SET_BIRTHDAY_MUTATION = gql`
  mutation SetBirthday($birthday: BirthdayInput) {
    setBirthday(birthday: $birthday) {
      id
      birthday {
        day
        month
      }
    }
  }
`;

export const MY_NICKNAME_QUERY = gql`
  query MyNickname {
    me {
      id
      username
      nicknameChangesLeft
    }
  }
`;

export const CHANGE_NICKNAME_MUTATION = gql`
  mutation ChangeNickname($username: String!) {
    changeNickname(username: $username) {
      id
      username
      nicknameChangesLeft
    }
  }
`;

export const SET_PROFILE_IMAGE_MUTATION = gql`
  mutation SetProfileImage($input: SetProfileImageInput!) {
    setProfileImage(input: $input) {
      id
      username
      email
      imageUrl
    }
  }
`;

export const ADD_COMMENT_MUTATION = gql`
  ${COMMENT_FIELDS}
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      ...CommentFields
    }
  }
`;

export const DELETE_COMMENT_MUTATION = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;

export const TORTILLA_EVENT_FIELDS = gql`
  fragment TortillaEventFields on TortillaEvent {
    id
    date
    note
    attendeeCount
    capacity
    isAttending
    myRequestStatus
    myQueuePosition
    pendingRequestCount
    pendingRequests {
      userId
      userName
      imageUrl
      requestedAt
    }
    closedAt
    open
    attendees {
      userName
      imageUrl
      allergens
      allergyNotes
    }
  }
`;

export const REVIEW_SPOT_REQUEST_MUTATION = gql`
  ${TORTILLA_EVENT_FIELDS}
  mutation ReviewSpotRequest($eventId: ID!, $userId: ID!, $approve: Boolean!) {
    reviewSpotRequest(eventId: $eventId, userId: $userId, approve: $approve) {
      ...TortillaEventFields
    }
  }
`;

export const UPCOMING_TORTILLA_QUERY = gql`
  ${TORTILLA_EVENT_FIELDS}
  query UpcomingTortilla($groupSlug: String!) {
    upcomingTortilla(groupSlug: $groupSlug) {
      ...TortillaEventFields
    }
  }
`;

export const ANNOUNCE_TORTILLA_MUTATION = gql`
  ${TORTILLA_EVENT_FIELDS}
  mutation AnnounceTortilla($input: AnnounceTortillaInput!) {
    announceTortilla(input: $input) {
      ...TortillaEventFields
    }
  }
`;

export const CLOSE_TORTILLA_EVENT_MUTATION = gql`
  ${TORTILLA_EVENT_FIELDS}
  mutation CloseTortillaEvent($id: ID!) {
    closeTortillaEvent(id: $id) {
      ...TortillaEventFields
    }
  }
`;

export const SET_ATTENDANCE_MUTATION = gql`
  ${TORTILLA_EVENT_FIELDS}
  mutation SetAttendance($id: ID!, $attending: Boolean!) {
    setAttendance(id: $id, attending: $attending) {
      ...TortillaEventFields
    }
  }
`;
