'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Brand } from './Brand';
import { useTheme } from './ThemeContext';
import { isActive, useNavLinks } from './navLinks';
import { UserChip } from './features/UserChip';
import { ME_QUERY } from '@/graphql/operations';
import styles from './NavBar.module.css';

type MeQueryResult = {
  me: { id: string; username: string; imageUrl: string | null } | null;
};

export function NavBar() {
  const pathname = usePathname();
  const { userName, userImage, signOut, isReady } = useUser();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  // Dentro de /g/<slug> los enlaces apuntan a ese grupo; fuera, a la lista.
  const { links, profileHref } = useNavLinks();

  const { data: meData } = useQuery<MeQueryResult>(ME_QUERY, {
    skip: !isReady || !userName,
    fetchPolicy: 'cache-and-network',
  });
  const avatarSrc = meData?.me?.imageUrl ?? userImage ?? undefined;

  const themeLabel =
    theme === 'dark' ? t('theme.toLight') : t('theme.toDark');
  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      className={styles.themeToggle}
      aria-label={themeLabel}
      title={themeLabel}
    >
      {theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
    </button>
  );

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brandLink} aria-label={t('app.title')}>
          <Brand size={30} />
        </Link>

        {isReady && userName ? (
          <nav className={styles.nav}>
            {links.map((l) => {
              const active = isActive(pathname, l.href);
              const linkClass = active
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={linkClass}
                  aria-current={active ? 'page' : undefined}
                >
                  {t(l.labelKey)}
                  {l.badge ? (
                    <span
                      className={styles.badge}
                      aria-label={t('nav.adminPending', { n: l.badge })}
                    >
                      {l.badge}
                    </span>
                  ) : null}
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
              {themeToggle}
              <UserChip
                userName={userName}
                imageUrl={avatarSrc}
                size={34}
                showName={false}
                href={profileHref}
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
              {themeToggle}
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
