'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Brand } from './Brand';
import { UserChip } from './features/UserChip';
import { ME_QUERY } from '@/graphql/operations';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import styles from './NavBar.module.css';

type MeQueryResult = {
  me: { id: string; username: string; imageUrl: string | null } | null;
};

export function NavBar() {
  const pathname = usePathname();
  const { userName, userImage, signOut, isReady } = useUser();
  const { t } = useLanguage();
  // Dentro de /g/<slug> los enlaces apuntan a ese grupo; fuera, a la lista.
  // Si el grupo no existe o no eres miembro, se comporta como fuera.
  const { slug, group, loading, isAdmin, pathFor } = useCurrentGroup();
  const inGroup = Boolean(slug) && (loading || group !== null);

  const { data: meData } = useQuery<MeQueryResult>(ME_QUERY, {
    skip: !isReady || !userName,
    fetchPolicy: 'cache-and-network',
  });
  const avatarSrc = meData?.me?.imageUrl ?? userImage ?? undefined;

  const links = inGroup
    ? [
        { href: pathFor('vote'), labelKey: 'nav.vote' as const },
        { href: pathFor('history'), labelKey: 'nav.history' as const },
        { href: pathFor('profile'), labelKey: 'nav.profile' as const },
        ...(isAdmin
          ? [{ href: pathFor('admin'), labelKey: 'nav.admin' as const }]
          : []),
      ]
    : [
        { href: '/groups', labelKey: 'nav.groups' as const },
        { href: '/profile', labelKey: 'nav.account' as const },
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
              <UserChip
                userName={userName}
                imageUrl={avatarSrc}
                size={34}
                showName={false}
                href={inGroup ? pathFor('profile') : '/profile'}
                ariaLabel={t('profile.title')}
                className={styles.avatarLink}
              />
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
