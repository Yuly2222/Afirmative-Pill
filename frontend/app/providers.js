'use client';
import { useState } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { makeClient } from '../lib/apollo';

export default function Providers({ children }) {
  // useState con inicializador: un único ApolloClient por pestaña, estable entre renders.
  const [client] = useState(makeClient);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
