import type { Metadata } from 'next';
import { ReactNode } from 'react';
import './globals.css';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { UserProvider } from '@/components/UserContext';
import { LanguageProvider } from '@/components/LanguageContext';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'TortiWeb',
  description:
    'Vota la tortilla / truita de cada miércoles / dimecres y consulta las puntuaciones medias del histórico.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ApolloWrapper>
          <LanguageProvider>
            <UserProvider>
              <NavBar />
              <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
            </UserProvider>
          </LanguageProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
