import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { isSubscriptionOperation } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const HTTP_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';
const WS_URL = HTTP_URL.replace(/^http/, 'ws');

const typePolicies = {
  Query: {
    fields: {
      // Paginación por cursor: una entrada de caché por (filter, sort); "Cargar más"
      // concatena páginas en vez de reemplazarlas.
      medications: {
        keyArgs: ['filter', 'sort'],
        merge(existing, incoming, { args }) {
          if (!args?.after || !existing) return incoming;
          return { ...incoming, nodes: [...existing.nodes, ...incoming.nodes] };
        },
      },
    },
  },
  // Listas embebidas (sin id propio): el servidor siempre manda la lista completa → reemplazar.
  Cart: { fields: { items: { merge: false } } },
  Order: { fields: { items: { merge: false }, statusHistory: { merge: false } } },
};

export function makeClient() {
  const httpLink = new HttpLink({ uri: HTTP_URL });
  // En el render del servidor (Next prerender) no se consulta la API: los datos
  // se piden en el navegador. Queries/Mutations → HTTP; Subscriptions → WebSocket.
  const link = typeof window === 'undefined'
    ? ApolloLink.empty()
    : split(
      ({ query }) => isSubscriptionOperation(query),
      new GraphQLWsLink(createClient({ url: WS_URL })),
      httpLink,
    );
  return new ApolloClient({ link, cache: new InMemoryCache({ typePolicies }) });
}
