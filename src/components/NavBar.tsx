'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Avatar } from 'antd';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ME_QUERY } from '@/graphql/operations';
import styles from './NavBar.module.css';

type MeQueryResult = {
  me: { id: string; username: string; imageUrl: string | null } | null;
};

export function NavBar() {
  const pathname = usePathname();
  const { userName, userImage, signOut, isReady } = useUser();
  const { t } = useLanguage();

  // La sesión JWT puede tener la imagen desactualizada (no se refresca en cada
  // request). Consultamos `me` para obtener siempre la imagen vigente en DB.
  const { data: meData } = useQuery<MeQueryResult>(ME_QUERY, {
    skip: !isReady || !userName,
    fetchPolicy: 'cache-and-network',
  });
  const avatarSrc = meData?.me?.imageUrl ?? userImage ?? undefined;

  const links = [
    { href: '/vote', labelKey: 'nav.vote' as const },
    { href: '/history', labelKey: 'nav.history' as const },
    { href: '/admin', labelKey: 'nav.admin' as const },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden>
            🍳
          </span>
          <span className={styles.brandText}>{t('app.title')}</span>
        </Link>

        <div className={styles.right}>
          <LanguageSwitcher />
          {isReady && userName ? (
            <div className={styles.greeting}>
              <Link href="/profile" className={styles.userName}>
                {t('nav.greetingPrefix')} <strong>{userName}</strong>
              </Link>
              <Link
                href="/profile"
                className={styles.avatarLink}
                aria-label={t('profile.title')}
              >
                <Avatar
                  src={avatarSrc}
                  size={32}
                  style={{
                    backgroundColor: 'var(--color-tortilla-500)',
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
              </Link>
              <button onClick={signOut} className={styles.linkButton}>
                {t('nav.signOut')}
              </button>
            </div>
          ) : (
            <Link href="/login" className={styles.linkButton}>
              {t('nav.signIn')}
            </Link>
          )}
        </div>

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
      </div>
    </header>
  );
}
