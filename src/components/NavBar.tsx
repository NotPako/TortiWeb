'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function NavBar() {
  const pathname = usePathname();
  const { userName, signOut, isReady } = useUser();
  const { t } = useLanguage();

  const links = [
    { href: '/vote', labelKey: 'nav.vote' as const },
    { href: '/history', labelKey: 'nav.history' as const },
    { href: '/admin', labelKey: 'nav.admin' as const },
  ];

  return (
    <header className="border-b border-tortilla-100 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-tortilla-700"
        >
          <span className="text-2xl" aria-hidden>
            🍳
          </span>
          <span>{t('app.title')}</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  'px-3 py-1.5 rounded-lg text-sm transition-colors ' +
                  (active
                    ? 'bg-tortilla-100 text-tortilla-800'
                    : 'text-tortilla-700 hover:bg-tortilla-50')
                }
              >
                {t(l.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <LanguageSwitcher />
          {isReady && userName ? (
            <div className="flex items-center gap-2">
              <span className="text-tortilla-800 hidden sm:inline">
                {t('nav.greetingPrefix')}{' '}
                <strong>{userName}</strong>
              </span>
              <button
                onClick={signOut}
                className="text-tortilla-600 hover:underline"
              >
                {t('nav.signOut')}
              </button>
            </div>
          ) : (
            <Link href="/" className="text-tortilla-600 hover:underline">
              {t('nav.signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
