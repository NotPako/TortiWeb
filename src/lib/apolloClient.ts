'use client';

import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
} from '@apollo/client';

let client: ApolloClient<unknown> | null = null;

export function getApolloClient() {
  if (client) return client;

  const httpLink = new HttpLink({
    uri: '/api/graphql',
    credentials: 'same-origin',
  });

  client = new ApolloClient({
    link: from([httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
    },
  });

  return client;
}
