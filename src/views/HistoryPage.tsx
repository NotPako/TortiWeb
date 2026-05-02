'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { TORTILLAS_QUERY } from '@/graphql/operations';
import styles from './HistoryPage.module.css';

type Tortilla = {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  imageUrl: string;
  averageScore: number | null;
  voteCount: number;
  myVote: { id: string; score: number } | null;
};

function ScoreBadge({
  score,
  noVotesLabel,
}: {
  score: number | null;
  noVotesLabel: string;
}) {
  if (score === null) {
    return (
      <span className={`${styles.badge} ${styles.badgeNoVotes}`}>
        {noVotesLabel}
      </span>
    );
  }
  const tier =
    score >= 8
      ? styles.badgeHigh
      : score >= 5
        ? styles.badgeMid
        : styles.badgeLow;
  return (
    <span className={`${styles.badge} ${tier}`}>{score.toFixed(2)} / 10</span>
  );
}

export default function HistoryPage() {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !userName) router.replace('/');
  }, [isReady, userName, router]);

  const { data, loading, error } = useQuery<{ tortillas: Tortilla[] }>(
    TORTILLAS_QUERY,
    { variables: { userName }, skip: !userName }
  );

  if (!isReady || !userName) return null;

  if (loading && !data) {
    return <p className={styles.statusText}>{t('history.loading')}</p>;
  }
  if (error) {
    return (
      <p className={styles.errorText}>
        {t('common.errorPrefix')}: {error.message}
      </p>
    );
  }

  const list = data?.tortillas ?? [];
  if (list.length === 0) {
    return (
      <div className={styles.emptyCard}>
        <p className={styles.emptyTitle}>{t('history.empty.title')}</p>
        <p className={styles.emptySubtitle}>{t('history.empty.subtitle')}</p>
      </div>
    );
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{t('history.title')}</h1>
      <div className={styles.grid}>
        {list.map((tortilla) => (
          <article key={tortilla.id} className={styles.card}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tortilla.imageUrl}
              alt={tortilla.name}
              className={styles.image}
              loading="lazy"
            />
            <div className={styles.body}>
              <div className={styles.headerRow}>
                <div>
                  <h2 className={styles.tortillaName}>{tortilla.name}</h2>
                  <p className={styles.dateText}>
                    {formatDate(tortilla.date)}
                  </p>
                </div>
                <ScoreBadge
                  score={tortilla.averageScore}
                  noVotesLabel={t('history.noVotes')}
                />
              </div>
              {tortilla.description ? (
                <p className={styles.description}>{tortilla.description}</p>
              ) : null}
              <div className={styles.metaRow}>
                <span>
                  {tortilla.voteCount}{' '}
                  {tortilla.voteCount === 1
                    ? t('history.voteSingular')
                    : t('history.votePlural')}
                </span>
                {tortilla.myVote ? (
                  <span>
                    {t('history.yourScore')}{' '}
                    <strong className={styles.yourScoreValue}>
                      {tortilla.myVote.score.toFixed(1)}
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
