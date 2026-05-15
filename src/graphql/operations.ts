import { gql } from '@apollo/client';

export const TORTILLA_FIELDS = gql`
  fragment TortillaFields on Tortilla {
    id
    name
    description
    date
    imageUrl
    averageScore
    voteCount
  }
`;

export const CURRENT_TORTILLA_QUERY = gql`
  ${TORTILLA_FIELDS}
  query CurrentTortilla {
    currentTortilla {
      ...TortillaFields
      myVote {
        id
        score
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
      }
    }
  }
`;

export const TORTILLA_DETAIL_QUERY = gql`
  ${TORTILLA_FIELDS}
  query TortillaDetail($id: ID!) {
    tortilla(id: $id) {
      ...TortillaFields
      myVote {
        id
        score
      }
      votes {
        id
        userName
        score
        createdAt
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
      createdAt
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
  mutation DeleteTortilla($id: ID!, $adminPassword: String!) {
    deleteTortilla(id: $id, adminPassword: $adminPassword)
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
