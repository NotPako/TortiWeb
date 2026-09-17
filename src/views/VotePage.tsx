'use client';

import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { Skeleton } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import { UpcomingTortillaCard } from '@/components/features/UpcomingTortillaCard';
import {
  TortillaVoteCard,
  type VotableTortilla,
} from '@/components/features/TortillaVoteCard';
import { CURRENT_TORTILLAS_QUERY } from '@/graphql/operations';
import styles from './VotePage.module.css';

export default function VotePage() {
  // Sesión y pertenencia ya las garantiza GroupGate en el layout del grupo.
  const { slug, isAdmin } = useCurrentGroup();
  const { t, locale } = useLanguage();

  const { data, loading, error, refetch } = useQuery<{
    currentTortillas: VotableTortilla[];
  }>(CURRENT_TORTILLAS_QUERY, {
    variables: { groupSlug: slug },
    skip: !slug,
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

  if (!slug) return null;

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
