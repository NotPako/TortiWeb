'use client';

import { fmt } from '@/lib/format';
import { useLanguage } from './LanguageContext';
import styles from './AvgPill.module.css';

type Props = {
  /** Media (0–10). null si no hay votos. */
  average: number | null;
  /** Número de votos total. */
  voteCount: number;
  /** Tamaño visual: lg en desktop, sm en móvil. */
  size?: 'sm' | 'lg';
};

export function AvgPill({ average, voteCount, size = 'sm' }: Props) {
  const { t } = useLanguage();
  const big = size === 'lg';
  return (
    <div className={styles.wrap}>
      <div className={big ? `${styles.pill} ${styles.pillLg}` : styles.pill}>
        <span className={big ? `${styles.value} ${styles.valueLg}` : styles.value}>
          {average !== null ? fmt(average) : '—'}
        </span>
        <span className={styles.suffix}>{t('avg.suffix')}</span>
      </div>
      <span className={styles.votes}>
        {voteCount}{' '}
        {voteCount === 1 ? t('history.voteSingular') : t('history.votePlural')}
      </span>
    </div>
  );
}
