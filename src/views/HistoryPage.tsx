'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import {
  CommentsSection,
  type CommentItem,
} from '@/components/features/CommentsSection';
import { Avatar, List, Modal, Pagination, Segmented, Skeleton, Tag } from 'antd';
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

type Reaction = 'fire' | 'yummy' | 'meh' | 'cringe';

const REACTION_EMOJI: Record<Reaction, string> = {
  fire: '🔥',
  yummy: '😋',
  meh: '😐',
  cringe: '😬',
};

type Vote = {
  id: string;
  userName: string;
  score: number;
  reaction?: Reaction | null;
  createdAt: string;
  imageUrl: string | null;
};

type TortillaDetail = Tortilla & {
  votes: Vote[];
  comments: CommentItem[];
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

// 12 = múltiplo de las 2 y 3 columnas del grid: las páginas quedan completas.
const PAGE_SIZE = 12;

export default function HistoryPage() {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isReady && !userName) router.replace('/login');
  }, [isReady, userName, router]);

  const { data, loading, error } = useQuery<{ tortillas: Tortilla[] }>(
    TORTILLAS_QUERY,
    { skip: !userName }
  );

  const {
    data: detailData,
    loading: detailLoading,
    refetch: refetchDetail,
  } = useQuery<{
    tortilla: TortillaDetail | null;
  }>(TORTILLA_DETAIL_QUERY, {
    variables: { id: selectedId },
    skip: !selectedId || !userName,
  });

  const detail = detailData?.tortilla ?? null;

  const sortedVotes = useMemo(() => {
    if (!detail?.votes) return [];
    return [...detail.votes].sort((a, b) => b.score - a.score);
  }, [detail?.votes]);

  const rawList = data?.tortillas ?? [];
  const list = useMemo(() => {
    if (sortBy === 'score') {
      return [...rawList].sort((a, b) => {
        if (a.averageScore === null && b.averageScore === null) return 0;
        if (a.averageScore === null) return 1;
        if (b.averageScore === null) return -1;
        return b.averageScore - a.averageScore;
      });
    }
    return rawList;
  }, [rawList, sortBy]);

  const pagedList = useMemo(
    () => list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [list, page]
  );

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
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }
  if (error) {
    return (
      <p className={styles.errorText}>
        {t('common.errorPrefix')}: {error.message}
      </p>
    );
  }

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
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('history.title')}</h1>
        <Segmented
          value={sortBy}
          onChange={(v) => {
            setSortBy(v as 'date' | 'score');
            setPage(1);
          }}
          options={[
            { label: t('history.sortByDate'), value: 'date' },
            { label: t('history.sortByScore'), value: 'score' },
          ]}
        />
      </div>
      <div className={styles.grid}>
        {pagedList.map((tortilla) => (
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

      <div className={styles.paginationRow}>
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={list.length}
          onChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          showSizeChanger={false}
          hideOnSinglePage
        />
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
          <Skeleton active avatar paragraph={{ rows: 4 }} />
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
              renderItem={(vote) => {
                const profileHref = `/profile/${encodeURIComponent(vote.userName)}`;
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Link
                          href={profileHref}
                          onClick={() => setSelectedId(null)}
                          aria-label={vote.userName}
                        >
                          <Avatar
                            src={vote.imageUrl ?? undefined}
                            style={{
                              backgroundColor: 'var(--color-tortilla-500)',
                              color: 'white',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {vote.userName.charAt(0).toUpperCase()}
                          </Avatar>
                        </Link>
                      }
                      title={
                        <Link
                          href={profileHref}
                          onClick={() => setSelectedId(null)}
                          className={styles.voterLink}
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          {vote.userName}
                        </Link>
                      }
                    />
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {vote.reaction ? (
                        <span style={{ fontSize: 18 }}>
                          {REACTION_EMOJI[vote.reaction]}
                        </span>
                      ) : null}
                      <Tag
                        color={tagColorForScore(vote.score)}
                        style={{ fontVariantNumeric: 'tabular-nums', margin: 0 }}
                      >
                        {vote.score.toFixed(1)} / 10
                      </Tag>
                    </div>
                  </List.Item>
                );
              }}
            />
            <div className={styles.modalCommentsWrap}>
              <CommentsSection
                tortillaId={detail.id}
                comments={detail.comments}
                onChanged={() => refetchDetail()}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
