'use client';

import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { Button, List, Tag } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import {
  AchievementsGrid,
  type AchievementItem,
} from '@/components/features/AchievementsGrid';
import { ProfileHeader } from '@/components/features/ProfileHeader';
import { TortillaImage } from '@/components/features/TortillaImage';
import { ProfilePageSkeleton } from '@/components/features/PageSkeletons';
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
  imageUrl: string | null;
  totalVotes: number;
  averageGiven: number | null;
  currentStreak: number;
  bestStreak: number;
  bestVote: PersonalVote | null;
  votes: PersonalVote[];
  achievements: AchievementItem[];
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

const VOTE_HISTORY_PAGE_SIZE = 10;

/**
 * Perfil de alguien dentro del grupo: solo cuenta lo que hizo en ese grupo.
 * Sin `username`, el propio (con enlace a "Mi cuenta" para editar foto,
 * nombre, cumpleaños y alergias, que son comunes a todos los grupos).
 */
export default function ProfilePage({ username }: Props = {}) {
  // Sesión y pertenencia ya las garantiza GroupGate en el layout del grupo.
  const { slug } = useCurrentGroup();
  const { t, locale } = useLanguage();
  const isOwn = !username;
  const historyCardRef = useRef<HTMLDivElement>(null);

  const { data: ownData, loading: ownLoading } = useQuery<{
    myStats: UserStats | null;
  }>(MY_STATS_QUERY, {
    variables: { groupSlug: slug },
    skip: !isOwn || !slug,
  });

  const { data: otherData, loading: otherLoading } = useQuery<{
    userStats: UserStats | null;
  }>(USER_STATS_QUERY, {
    variables: { groupSlug: slug, username: username ?? '' },
    skip: isOwn || !slug,
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

  if (!slug) return null;

  if (loading && !data) {
    return <ProfilePageSkeleton />;
  }

  const displayName = stats?.username ?? username ?? '';
  const title = isOwn
    ? t('profile.title')
    : t('profile.titleFor', { name: displayName });

  const header = (
    <ProfileHeader userName={displayName} imageUrl={stats?.imageUrl} title={title}>
      {isOwn ? (
        <Link href="/profile">
          <Button size="small" icon={<SettingOutlined />}>
            {t('account.editLink')}
          </Button>
        </Link>
      ) : null}
    </ProfileHeader>
  );

  if (!stats || stats.totalVotes === 0) {
    return (
      <div className={styles.wrap}>
        {header}
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
      {header}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('profile.totalVotes')}</span>
          <span className={styles.statValue}>{stats.totalVotes}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('profile.averageGiven')}</span>
          <span className={styles.statValue}>
            {stats.averageGiven !== null ? stats.averageGiven.toFixed(2) : '—'}
            <span className={styles.statSuffix}>/10</span>
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('profile.currentStreak')}</span>
          <span className={styles.statValue}>
            <span aria-hidden>🔥</span> {stats.currentStreak}
          </span>
          <span className={styles.statFoot}>
            {stats.bestStreak > stats.currentStreak
              ? t('profile.bestStreak', { n: stats.bestStreak })
              : stats.currentStreak === 1
                ? t('profile.streakUnitSingular')
                : t('profile.streakUnit')}
          </span>
        </div>
      </div>

      {stats.achievements.length > 0 ? (
        <AchievementsGrid achievements={stats.achievements} />
      ) : null}

      {stats.bestVote ? (
        <div className={styles.bestCard}>
          <p className={styles.bestLabel}>{t('profile.bestTortilla')}</p>
          <div className={styles.bestInner}>
            <TortillaImage
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

      <div className={styles.historyCard} ref={historyCardRef}>
        <List
          header={<strong>{t('profile.voteHistory')}</strong>}
          dataSource={sortedVotes}
          pagination={{
            pageSize: VOTE_HISTORY_PAGE_SIZE,
            hideOnSinglePage: true,
            showSizeChanger: false,
            align: 'center',
            // El historial vive al final de una página larga: subimos a la
            // tarjeta, no al principio del documento.
            onChange: () =>
              historyCardRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              }),
          }}
          renderItem={(vote) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <TortillaImage
                    src={vote.tortilla.imageUrl}
                    alt={vote.tortilla.name}
                    className={styles.voteThumb}
                    loading="lazy"
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
