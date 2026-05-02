'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Avatar, List, Modal, Tag } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import {
  TORTILLAS_QUERY,
  TORTILLA_DETAIL_QUERY,
} from '@/graphql/operations';
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

type Vote = {
  id: string;
  userName: string;
  score: number;
  createdAt: string;
};

type TortillaDetail = Tortilla & {
  votes: Vote[];
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

function tagColorForScore(score: number): string {
  if (score >= 8) return 'green';
  if (score >= 5) return 'gold';
  return 'red';
}

export default function HistoryPage() {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !userName) router.replace('/');
  }, [isReady, userName, router]);

  const { data, loading, error } = useQuery<{ tortillas: Tortilla[] }>(
    TORTILLAS_QUERY,
    { variables: { userName }, skip: !userName }
  );

  const { data: detailData, loading: detailLoading } = useQuery<{
    tortilla: TortillaDetail | null;
  }>(TORTILLA_DETAIL_QUERY, {
    variables: { id: selectedId, userName },
    skip: !selectedId || !userName,
  });

  const detail = detailData?.tortilla ?? null;

  const sortedVotes = useMemo(() => {
    if (!detail?.votes) return [];
    return [...detail.votes].sort((a, b) => b.score - a.score);
  }, [detail?.votes]);

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

  function formatLongDate(date: string) {
    try {
      return new Date(date).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }

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

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{t('history.title')}</h1>
      <div className={styles.grid}>
        {list.map((tortilla) => (
          <button
            key={tortilla.id}
            type="button"
            className={styles.card}
            onClick={() => setSelectedId(tortilla.id)}
            aria-label={`${t('history.viewDetails')} — ${tortilla.name}`}
          >
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
          </button>
        ))}
      </div>

      <Modal
        open={!!selectedId}
        onCancel={() => setSelectedId(null)}
        footer={null}
        title={detail?.name ?? ''}
        width={520}
        destroyOnClose
      >
        {detailLoading && !detail ? (
          <p className={styles.statusText}>{t('common.loading')}</p>
        ) : detail ? (
          <div>
            <div className={styles.modalImageWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.imageUrl}
                alt={detail.name}
                className={styles.modalImage}
              />
            </div>
            <p className={styles.modalDate}>{formatLongDate(detail.date)}</p>
            {detail.description ? (
              <p className={styles.modalDescription}>{detail.description}</p>
            ) : null}
            <div className={styles.modalSummary}>
              <span>
                {t('vote.average')}{' '}
                <strong className={styles.voteScore}>
                  {detail.averageScore !== null
                    ? detail.averageScore.toFixed(2)
                    : '—'}
                </strong>
              </span>
              <span>
                {detail.voteCount}{' '}
                {detail.voteCount === 1
                  ? t('history.voteSingular')
                  : t('history.votePlural')}
              </span>
            </div>
            <List
              header={<strong>{t('history.individualVotes')}</strong>}
              dataSource={sortedVotes}
              locale={{ emptyText: t('history.noVotesYet') }}
              renderItem={(vote) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          backgroundColor: 'var(--color-tortilla-500)',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        {vote.userName.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    title={vote.userName}
                  />
                  <Tag
                    color={tagColorForScore(vote.score)}
                    style={{ fontVariantNumeric: 'tabular-nums', margin: 0 }}
                  >
                    {vote.score.toFixed(1)} / 10
                  </Tag>
                </List.Item>
              )}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
