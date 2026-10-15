'use client';

import { useQuery } from '@apollo/client';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import { useLanguage } from '@/components/LanguageContext';
import { UserChip } from '@/components/features/UserChip';
import { TortillaImage } from '@/components/features/TortillaImage';
import { RankingPageSkeleton } from '@/components/features/PageSkeletons';
import { RANKING_QUERY } from '@/graphql/operations';
import { fmt } from '@/lib/format';
import type { TranslationKey } from '@/lib/i18n';
import styles from './RankingPage.module.css';

type RankedTortilla = {
  averageScore: number;
  voteCount: number;
  tortilla: { id: string; name: string; date: string; imageUrl: string };
};

type RankedVoter = {
  userName: string;
  imageUrl: string | null;
  value: number;
  voteCount: number;
};

type Ranking = {
  year: number;
  minVotesPerTortilla: number;
  minVotesPerVoter: number;
  bestTortillas: RankedTortilla[];
  toughest: RankedVoter[];
  generous: RankedVoter[];
  streaks: RankedVoter[];
  mostVotes: RankedVoter[];
};

const MEDALS = ['🥇', '🥈', '🥉'];

/** Orden visual del podio: segundo, primero, tercero. */
const PODIUM_ORDER = [1, 0, 2];

function VoterBoard({
  emoji,
  titleKey,
  hintKey,
  voters,
  formatValue,
  minVotes,
}: {
  emoji: string;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  voters: RankedVoter[];
  formatValue: (v: RankedVoter) => string;
  minVotes: number;
}) {
  const { t } = useLanguage();
  return (
    <section className={styles.board}>
      <header className={styles.boardHeader}>
        <span className={styles.boardEmoji} aria-hidden>
          {emoji}
        </span>
        <div>
          <h2 className={styles.boardTitle}>{t(titleKey)}</h2>
          <p className={styles.boardHint}>{t(hintKey, { n: minVotes })}</p>
        </div>
      </header>
      {voters.length === 0 ? (
        <p className={styles.boardEmpty}>{t('ranking.emptyBoard')}</p>
      ) : (
        <ol className={styles.boardList}>
          {voters.map((v, i) => (
            <li
              key={v.userName}
              className={i === 0 ? `${styles.row} ${styles.rowFirst}` : styles.row}
            >
              <span className={styles.medal} aria-label={`#${i + 1}`}>
                {MEDALS[i]}
              </span>
              <UserChip
                userName={v.userName}
                imageUrl={v.imageUrl}
                size={30}
                className={styles.chip}
              />
              <span className={styles.value}>{formatValue(v)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function RankingPage() {
  // Sesión y pertenencia ya las garantiza GroupGate en el layout del grupo.
  const { slug } = useCurrentGroup();
  const { t, locale } = useLanguage();

  const { data, loading, error } = useQuery<{ ranking: Ranking }>(
    RANKING_QUERY,
    { variables: { groupSlug: slug }, skip: !slug, fetchPolicy: 'cache-and-network' }
  );

  if (!slug) return null;
  if (loading && !data) return <RankingPageSkeleton />;
  if (error || !data) {
    return (
      <p className={styles.error}>
        {t('common.errorPrefix')}: {error?.message}
      </p>
    );
  }

  const r = data.ranking;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className={styles.wrap}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>{t('ranking.title')}</h1>
        <p className={styles.subtitle}>{t('ranking.subtitle')}</p>
      </header>

      <section className={styles.podiumCard}>
        <h2 className={styles.podiumTitle}>
          🏆 {t('ranking.bestTortillas', { year: r.year })}
        </h2>
        {r.bestTortillas.length === 0 ? (
          <p className={styles.boardEmpty}>
            {t('ranking.noTortillas', { n: r.minVotesPerTortilla })}
          </p>
        ) : (
          <ol className={styles.podium}>
            {PODIUM_ORDER.filter((i) => r.bestTortillas[i]).map((i) => {
              const entry = r.bestTortillas[i];
              return (
                <li
                  key={entry.tortilla.id}
                  className={`${styles.step} ${styles[`step${i + 1}`]}`}
                >
                  <span className={styles.stepMedal} aria-label={`#${i + 1}`}>
                    {MEDALS[i]}
                  </span>
                  <TortillaImage
                    src={entry.tortilla.imageUrl}
                    alt={entry.tortilla.name}
                    className={styles.stepPhoto}
                    loading="lazy"
                  />
                  <span className={styles.stepName}>{entry.tortilla.name}</span>
                  <span className={styles.stepDate}>
                    {formatDate(entry.tortilla.date)}
                  </span>
                  <span className={styles.stepBlock}>
                    <span className={styles.stepScore}>
                      {fmt(entry.averageScore)}
                    </span>
                    <span className={styles.stepVotes}>
                      {t('ranking.votes', { n: entry.voteCount })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className={styles.boards}>
        <VoterBoard
          emoji="😠"
          titleKey="ranking.toughest"
          hintKey="ranking.averageHint"
          voters={r.toughest}
          minVotes={r.minVotesPerVoter}
          formatValue={(v) => fmt(v.value)}
        />
        <VoterBoard
          emoji="⭐"
          titleKey="ranking.generous"
          hintKey="ranking.averageHint"
          voters={r.generous}
          minVotes={r.minVotesPerVoter}
          formatValue={(v) => fmt(v.value)}
        />
        <VoterBoard
          emoji="🔥"
          titleKey="ranking.streaks"
          hintKey="ranking.streaksHint"
          voters={r.streaks}
          minVotes={r.minVotesPerVoter}
          formatValue={(v) =>
            v.value === 1
              ? t('ranking.inARowOne')
              : t('ranking.inARow', { n: v.value })
          }
        />
        <VoterBoard
          emoji="🍳"
          titleKey="ranking.mostVotes"
          hintKey="ranking.mostVotesHint"
          voters={r.mostVotes}
          minVotes={r.minVotesPerVoter}
          formatValue={(v) =>
            `${v.value} ${v.value === 1 ? t('history.voteSingular') : t('history.votePlural')}`
          }
        />
      </div>
    </div>
  );
}
