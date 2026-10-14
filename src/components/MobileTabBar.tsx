'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';
import { isActive, navLinks } from './navLinks';
import styles from './MobileTabBar.module.css';

/**
 * Pestañas fijas abajo en móvil, al alcance del pulgar. En escritorio no se
 * muestran (CSS): ahí las secciones van en la barra superior.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { userName, isReady, isAdmin } = useUser();
  const { t } = useLanguage();

  if (!isReady || !userName) return null;

  return (
    <nav className={styles.bar} aria-label={t('nav.sections')}>
      {navLinks(isAdmin).map((l) => {
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
            </span>
            <span className={styles.label}>{t(l.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
