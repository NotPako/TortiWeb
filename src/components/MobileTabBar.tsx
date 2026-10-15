'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { isActive, useNavLinks } from './navLinks';
import styles from './MobileTabBar.module.css';

/**
 * Pestañas fijas abajo en móvil, al alcance del pulgar. En escritorio no se
 * muestran (CSS): ahí las secciones van en la barra superior.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { userName, isReady } = useUser();
  const { t } = useLanguage();
  const { links } = useNavLinks();

  if (!isReady || !userName) return null;

  return (
    <nav className={styles.bar} aria-label={t('nav.sections')}>
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.icon} aria-hidden>
              {l.icon}
              {l.badge ? <span className={styles.badge}>{l.badge}</span> : null}
            </span>
            {l.badge ? (
              <span className={styles.srOnly}>
                {t('nav.adminPending', { n: l.badge })}
              </span>
            ) : null}
            <span className={styles.label}>{t(l.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
