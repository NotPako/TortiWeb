'use client';

import type { CSSProperties } from 'react';
import { useLanguage } from '@/components/LanguageContext';
import styles from './PageSkeletons.module.css';

/**
 * Esqueletos de carga con la forma de cada pantalla: al llegar los datos,
 * el contenido aparece donde ya estaba su hueco y la página no salta.
 */

function Bone({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <span
      className={className ? `${styles.bone} ${className}` : styles.bone}
      style={style}
    />
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className={styles.wrap} role="status" aria-busy="true">
      <span className={styles.srOnly}>{t('common.loading')}</span>
      {children}
    </div>
  );
}

export function VotePageSkeleton() {
  return (
    <Loading>
      <Bone className={styles.hero} />
      <div className={styles.voteGrid}>
        <div className={`${styles.card} ${styles.col}`}>
          <Bone style={{ width: '55%', height: 22 }} />
          <div className={styles.row}>
            <Bone style={{ flex: 1, height: 48 }} />
            <Bone style={{ width: 120, height: 48 }} />
          </div>
          <Bone style={{ width: '100%', height: 10, borderRadius: 999 }} />
          <div className={styles.row}>
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} style={{ width: 84, height: 30, borderRadius: 999 }} />
            ))}
          </div>
          <Bone style={{ width: '100%', height: 50, borderRadius: 13 }} />
        </div>
        <div className={`${styles.card} ${styles.col}`}>
          <Bone style={{ width: '40%', height: 18 }} />
          {[0, 1].map((i) => (
            <div key={i} className={styles.row}>
              <Bone style={{ width: 32, height: 32, borderRadius: '50%' }} />
              <Bone style={{ flex: 1, height: 36 }} />
            </div>
          ))}
          <Bone style={{ width: '100%', height: 64 }} />
        </div>
      </div>
    </Loading>
  );
}

export function HistoryPageSkeleton() {
  return (
    <Loading>
      <div className={styles.row} style={{ justifyContent: 'space-between' }}>
        <Bone style={{ width: 160, height: 28 }} />
        <Bone style={{ width: 200, height: 32 }} />
      </div>
      <Bone style={{ width: '100%', maxWidth: 420, height: 32 }} />
      <div className={styles.historyGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.historyCard}>
            <Bone className={styles.square} />
            <div className={styles.col} style={{ padding: 12 }}>
              <Bone style={{ width: '70%', height: 18 }} />
              <Bone style={{ width: '45%', height: 12 }} />
              <Bone style={{ width: '35%', height: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function ProfilePageSkeleton() {
  return (
    <Loading>
      <div className={styles.row} style={{ gap: 16 }}>
        <Bone style={{ width: 88, height: 88, borderRadius: '50%' }} />
        <div className={styles.col} style={{ flex: 1 }}>
          <Bone style={{ width: 160, height: 26 }} />
          <Bone style={{ width: 220, height: 24 }} />
        </div>
      </div>
      <Bone style={{ width: '100%', height: 56, borderRadius: 18 }} />
      <div className={styles.statsRow}>
        {[0, 1, 2].map((i) => (
          <Bone key={i} style={{ height: 92, borderRadius: 18 }} />
        ))}
      </div>
      <Bone style={{ width: '100%', height: 220, borderRadius: 18 }} />
    </Loading>
  );
}

export function RankingPageSkeleton() {
  return (
    <Loading>
      <Bone style={{ width: 180, height: 28 }} />
      <Bone style={{ width: '100%', height: 180, borderRadius: 20 }} />
      <div className={styles.statsRow}>
        {[0, 1, 2].map((i) => (
          <Bone key={i} style={{ height: 160, borderRadius: 18 }} />
        ))}
      </div>
    </Loading>
  );
}
