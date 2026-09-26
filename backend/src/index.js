import http from 'node:http';
import { readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { resolvers } from './resolvers.js';
import { createLoaders } from './loaders.js';
import { catchUpProjections } from './read/projector.js';

const PORT = Number(process.env.PORT ?? 4000);
const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8');
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Contexto por operación: DataLoaders nuevos cada vez (caché acotada al request).
const context = async () => ({ loaders: createLoaders() });

const app = express();
app.disable('x-powered-by');
const httpServer = http.createServer(app);

// Subscriptions: WebSocket (protocolo graphql-ws) en la MISMA ruta /graphql.
const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
const wsCleanup = useServer(
  {
    schema,
    context,
    onSubscribe: (_ctx, _id, payload) => console.log(`\n[GraphQL] subscription ${payload.operationName ?? '(anónima)'} ${JSON.stringify(payload.variables ?? {})}`),
  },
  wsServer,
);

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    { async serverWillStart() { return { async drainServer() { await wsCleanup.dispose(); } }; } },
    {
      // Log por operación: permite ver en consola qué SQL y qué lotes de DataLoader produce cada una.
      async requestDidStart() {
        return {
          async didResolveOperation({ operation, operationName }) {
            console.log(`\n[GraphQL] ${operation.operation} ${operationName ?? '(anónima)'}`);
          },
        };
      },
    },
  ],
});
await server.start();

// ZERO-REST: /graphql es la ÚNICA ruta del servidor. No hay app.get/app.post de
// ningún recurso; cualquier otra URL responde 404 (comportamiento por defecto de Express).
app.use(
  '/graphql',
  cors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',') }),
  express.json({ limit: '100kb' }),
  expressMiddleware(server, { context }),
);

httpServer.listen(PORT, async () => {
  console.log(`🚀 GraphQL (HTTP + WS) en http://localhost:${PORT}/graphql`);
  await catchUpProjections().catch((err) => console.error('[Projector] catch-up falló', err));
});
