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

export const CURRENT_TORTILLA_QUERY = gql`
  ${TORTILLA_FIELDS}
  ${COMMENT_FIELDS}
  query CurrentTortilla {
    currentTortilla {
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
  }
`;

export const MY_STATS_QUERY = gql`
  query MyStats {
    myStats {
      ${USER_STATS_FIELDS}
    }
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
  mutation SetUsername($username: String!) {
    setUsername(username: $username) {
      id
      username
      email
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
