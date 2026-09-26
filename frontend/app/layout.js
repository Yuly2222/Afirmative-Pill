import './globals.css';
import Providers from './providers';
import Nav from './nav';

export const metadata = {
  title: 'Afirmative Pill',
  description: 'E-commerce farmacéutico sobre GraphQL + CQRS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {/* ApolloProvider en la raíz: todo el árbol comparte un cliente y una caché. */}
        <Providers>
          <Nav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
