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
  query CurrentTortilla($userName: String) {
    currentTortilla(userName: $userName) {
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
  query Tortillas($userName: String) {
    tortillas(userName: $userName) {
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
  query TortillaDetail($id: ID!, $userName: String) {
    tortilla(id: $id, userName: $userName) {
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
