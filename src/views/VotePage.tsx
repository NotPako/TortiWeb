'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Skeleton } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { UpcomingTortillaCard } from '@/components/features/UpcomingTortillaCard';
import {
  TortillaVoteCard,
  type VotableTortilla,
} from '@/components/features/TortillaVoteCard';
import { CURRENT_TORTILLAS_QUERY } from '@/graphql/operations';
import styles from './VotePage.module.css';

export default function VotePage() {
  const { userName, isReady, isAdmin } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !userName) router.replace('/login');
  }, [isReady, userName, router]);

  const { data, loading, error, refetch } = useQuery<{
    currentTortillas: VotableTortilla[];
  }>(CURRENT_TORTILLAS_QUERY, {
    skip: !userName,
  });

  const tortillas = useMemo(
    () => data?.currentTortillas ?? [],
    [data?.currentTortillas]
  );

  // Todas las tortillas abiertas son del mismo día, así que la etiqueta de
  // jornada se calcula una vez y se comparte.
  const eyebrowDate = useMemo(() => {
    const first = tortillas[0];
    if (!first) return '';
    try {
      const d = new Date(first.date);
      const weekday = d
        .toLocaleDateString(locale, { weekday: 'short' })
        .replace('.', '');
      const day = d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      });
      return `${weekday} · ${day}`;
    } catch {
      return first.date;
    }
  }, [tortillas, locale]);

  if (!isReady || !userName) return null;

  if (loading && !data) {
    return (
      <>
        <UpcomingTortillaCard />
        <Skeleton active paragraph={{ rows: 6 }} />
      </>
    );
  }
  if (error) {
    return (
      <>
        <UpcomingTortillaCard />
        <div className={styles.errorBox}>
          {t('vote.errorLoading')} {error.message}{' '}
          <button onClick={() => refetch()} className={styles.retry}>
            {t('common.retry')}
          </button>
        </div>
      </>
    );
  }
  if (tortillas.length === 0) {
    return (
      <>
        <UpcomingTortillaCard />
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>{t('vote.empty.title')}</p>
          <p className={styles.emptySubtitle}>{t('vote.empty.subtitle')}</p>
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <UpcomingTortillaCard />

      {tortillas.length > 1 ? (
        <p className={styles.multiNotice}>
          {t('vote.multiple', { n: tortillas.length })}
        </p>
      ) : null}

      {tortillas.map((tortilla) => (
        <TortillaVoteCard
          key={tortilla.id}
          tortilla={tortilla}
          isAdmin={isAdmin}
          eyebrowDate={eyebrowDate}
          onChanged={() => refetch()}
        />
      ))}
    </div>
  );
}
