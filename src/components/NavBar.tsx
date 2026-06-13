'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Avatar } from 'antd';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Brand } from './Brand';
import { ME_QUERY } from '@/graphql/operations';
import styles from './NavBar.module.css';

type MeQueryResult = {
  me: { id: string; username: string; imageUrl: string | null } | null;
};

export function NavBar() {
  const pathname = usePathname();
  const { userName, userImage, signOut, isReady, isAdmin } = useUser();
  const { t } = useLanguage();

  const { data: meData } = useQuery<MeQueryResult>(ME_QUERY, {
    skip: !isReady || !userName,
    fetchPolicy: 'cache-and-network',
  });
  const avatarSrc = meData?.me?.imageUrl ?? userImage ?? undefined;

  const links = [
    { href: '/vote', labelKey: 'nav.vote' as const },
    { href: '/history', labelKey: 'nav.history' as const },
    { href: '/profile', labelKey: 'nav.profile' as const },
    ...(isAdmin
      ? [{ href: '/admin', labelKey: 'nav.admin' as const }]
      : []),
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brandLink} aria-label={t('app.title')}>
          <Brand size={30} />
        </Link>

        {isReady && userName ? (
          <nav className={styles.nav}>
            {links.map((l) => {
              const active = pathname === l.href;
              const linkClass = active
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink;
              return (
                <Link key={l.href} href={l.href} className={linkClass}>
                  {t(l.labelKey)}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className={styles.right}>
          {isReady && userName ? (
            <>
              <span className={styles.greeting}>
                {t('nav.greetingPrefix')}{' '}
                <strong className={styles.userName}>{userName}</strong>
              </span>
              <LanguageSwitcher />
              <Link
                href="/profile"
                className={styles.avatarLink}
                aria-label={t('profile.title')}
              >
                <Avatar
                  src={avatarSrc}
                  size={34}
                  style={{
                    background:
                      'linear-gradient(135deg, var(--c-amber-lite), var(--c-amber-deep))',
                    color: 'white',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
              </Link>
              <button
                onClick={signOut}
                className={styles.signOut}
                aria-label={t('nav.signOut')}
              >
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <Link href="/login" className={styles.signIn}>
                {t('nav.signIn')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
