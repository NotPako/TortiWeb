import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';

import styles from './layout.module.css';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { SessionWrapper } from '@/components/SessionWrapper';
import { LanguageProvider } from '@/components/LanguageContext';
import { NavBar } from '@/components/NavBar';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

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
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${manrope.variable}`}
    >
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
