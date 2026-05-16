'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from 'antd';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import styles from './NavBar.module.css';

export function NavBar() {
  const pathname = usePathname();
  const { userName, userImage, signOut, isReady } = useUser();
  const { t } = useLanguage();

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
                  src={userImage ?? undefined}
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
