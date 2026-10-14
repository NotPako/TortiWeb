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
  query CurrentTortillas {
    currentTortillas {
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
  query TortillaDates {
    tortillas {
      id
      date
    }
  }
`;

export const TORTILLAS_QUERY = gql`
  ${TORTILLA_FIELDS}
  query Tortillas {
    tortillas {
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
  }
`;

export const MY_STATS_QUERY = gql`
  query MyStats {
    myStats {
      ${USER_STATS_FIELDS}
    }
  }
`;

export const NEW_ACHIEVEMENTS_QUERY = gql`
  query NewAchievements {
    newAchievements {
      id
      emoji
      unlocked
    }
  }
`;

export const MARK_ACHIEVEMENTS_SEEN_MUTATION = gql`
  mutation MarkAchievementsSeen($ids: [String!]!) {
    markAchievementsSeen(ids: $ids)
  }
`;

export const USER_STATS_QUERY = gql`
  query UserStats($username: String!) {
    userStats(username: $username) {
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
  query Ranking {
    ranking {
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
    isAttending
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

export const UPCOMING_TORTILLA_QUERY = gql`
  ${TORTILLA_EVENT_FIELDS}
  query UpcomingTortilla {
    upcomingTortilla {
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
