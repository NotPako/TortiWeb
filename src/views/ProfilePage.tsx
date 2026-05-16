'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Avatar, List, Skeleton, Statistic, Tag } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { MY_STATS_QUERY, USER_STATS_QUERY } from '@/graphql/operations';
import styles from './ProfilePage.module.css';

type Reaction = 'fire' | 'yummy' | 'meh' | 'cringe';

const REACTION_EMOJI: Record<Reaction, string> = {
  fire: '🔥',
  yummy: '😋',
  meh: '😐',
  cringe: '😬',
};

type TortillaSummary = {
  id: string;
  name: string;
  date: string;
  imageUrl: string;
};

type PersonalVote = {
  id: string;
  score: number;
  reaction?: Reaction | null;
  createdAt: string;
  tortilla: TortillaSummary;
};

type UserStats = {
  username: string;
  totalVotes: number;
  averageGiven: number | null;
  currentStreak: number;
  bestStreak: number;
  bestVote: PersonalVote | null;
  votes: PersonalVote[];
};

type Props = {
  /** Si se proporciona, muestra el perfil de ese usuario. Si no, el del usuario autenticado. */
  username?: string;
};

function tagColorForScore(score: number): string {
  if (score >= 8) return 'green';
  if (score >= 5) return 'gold';
  return 'red';
}

export default function ProfilePage({ username }: Props = {}) {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const isOwn = !username;

  useEffect(() => {
    if (isOwn && isReady && !userName) router.replace('/login');
  }, [isOwn, isReady, userName, router]);

  const { data: ownData, loading: ownLoading } = useQuery<{
    myStats: UserStats | null;
  }>(MY_STATS_QUERY, { skip: !isOwn || !userName });

  const { data: otherData, loading: otherLoading } = useQuery<{
    userStats: UserStats | null;
  }>(USER_STATS_QUERY, {
    variables: { username: username ?? '' },
    skip: isOwn,
  });

  const stats = isOwn
    ? ownData?.myStats ?? null
    : otherData?.userStats ?? null;
  const loading = isOwn ? ownLoading : otherLoading;
  const data = isOwn ? ownData : otherData;

  const sortedVotes = useMemo(() => {
    if (!stats?.votes) return [];
    return [...stats.votes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [stats?.votes]);

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

  if (isOwn && (!isReady || !userName)) return null;

  if (loading && !data) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  const displayName = stats?.username ?? username ?? '';
  const title = isOwn
    ? t('profile.title')
    : t('profile.titleFor', { name: displayName });

  if (!stats || stats.totalVotes === 0) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.emptyCard}>
          <p className={styles.emptyText}>
            {isOwn
              ? t('profile.noVotes')
              : t('profile.noVotesOther', { name: displayName })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Statistic
            title={t('profile.totalVotes')}
            value={stats.totalVotes}
            valueStyle={{ color: 'var(--color-tortilla-700)', fontWeight: 700 }}
          />
        </div>
        <div className={styles.statCard}>
          <Statistic
            title={t('profile.averageGiven')}
            value={
              stats.averageGiven !== null
                ? stats.averageGiven.toFixed(2)
                : '—'
            }
            suffix="/ 10"
            valueStyle={{ color: 'var(--color-tortilla-700)', fontWeight: 700 }}
          />
        </div>
        <div className={`${styles.statCard} ${styles.streakCard}`}>
          <Statistic
            title={t('profile.currentStreak')}
            value={stats.currentStreak}
            prefix={<span className={styles.streakEmoji}>🔥</span>}
            suffix={
              stats.currentStreak === 1
                ? t('profile.streakUnitSingular')
                : t('profile.streakUnit')
            }
            valueStyle={{ color: 'var(--color-tortilla-700)', fontWeight: 700 }}
          />
          {stats.bestStreak > 0 && stats.bestStreak > stats.currentStreak ? (
            <p className={styles.streakBest}>
              {t('profile.bestStreak', { n: stats.bestStreak })}
            </p>
          ) : null}
        </div>
      </div>

      {stats.bestVote ? (
        <div className={styles.bestCard}>
          <p className={styles.bestLabel}>{t('profile.bestTortilla')}</p>
          <div className={styles.bestInner}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stats.bestVote.tortilla.imageUrl}
              alt={stats.bestVote.tortilla.name}
              className={styles.bestImage}
            />
            <div className={styles.bestInfo}>
              <p className={styles.bestName}>{stats.bestVote.tortilla.name}</p>
              <p className={styles.bestDate}>
                {formatDate(stats.bestVote.tortilla.date)}
              </p>
              <div className={styles.bestScoreRow}>
                {stats.bestVote.reaction ? (
                  <span className={styles.bestEmoji}>
                    {REACTION_EMOJI[stats.bestVote.reaction]}
                  </span>
                ) : null}
                <Tag
                  color={tagColorForScore(stats.bestVote.score)}
                  style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, padding: '2px 10px' }}
                >
                  {stats.bestVote.score.toFixed(1)} / 10
                </Tag>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.historyCard}>
        <List
          header={<strong>{t('profile.voteHistory')}</strong>}
          dataSource={sortedVotes}
          renderItem={(vote) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar
                    src={vote.tortilla.imageUrl}
                    shape="square"
                    size={48}
                    style={{ borderRadius: 8, flexShrink: 0 }}
                  />
                }
                title={vote.tortilla.name}
                description={formatDate(vote.tortilla.date)}
              />
              <div className={styles.voteRight}>
                {vote.reaction ? (
                  <span className={styles.voteEmoji}>
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
          )}
        />
      </div>
    </div>
  );
}
