import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';

import styles from './layout.module.css';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { SessionWrapper } from '@/components/SessionWrapper';
import { LanguageProvider } from '@/components/LanguageContext';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'TortiWeb',
  description:
    'Vota la tortilla / truita de cada miércoles / dimecres y consulta las puntuaciones medias del histórico.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f59300',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AntdRegistry>
          <SessionWrapper>
            <ApolloWrapper>
              <LanguageProvider>
                <NavBar />
                <main className={styles.main}>{children}</main>
              </LanguageProvider>
            </ApolloWrapper>
          </SessionWrapper>
        </AntdRegistry>
      </body>
    </html>
  );
}
