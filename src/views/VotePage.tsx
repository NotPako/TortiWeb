'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { Skeleton } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { VoteSlider } from '@/components/VoteSlider';
import { ReactionPicker } from '@/components/features/ReactionPicker';
import {
  CommentsSection,
  type CommentItem,
} from '@/components/features/CommentsSection';
import type { Reaction } from '@/models/Vote';
import {
  CAST_VOTE_MUTATION,
  CLOSE_TORTILLA_VOTING_MUTATION,
  CURRENT_TORTILLA_QUERY,
  TORTILLAS_QUERY,
} from '@/graphql/operations';
import styles from './VotePage.module.css';

type Tortilla = {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  imageUrl: string;
  averageScore: number | null;
  voteCount: number;
  myVote: { id: string; score: number; reaction?: Reaction | null } | null;
  closedAt: string | null;
  votingOpen: boolean;
  comments: CommentItem[];
};

export default function VotePage() {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [score, setScore] = useState(7);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !userName) router.replace('/login');
  }, [isReady, userName, router]);

  const { data, loading, error, refetch } = useQuery<{
    currentTortilla: Tortilla | null;
  }>(CURRENT_TORTILLA_QUERY, {
    skip: !userName,
  });

  const tortilla = data?.currentTortilla ?? null;

  useEffect(() => {
    if (tortilla?.myVote) {
      setScore(tortilla.myVote.score);
      setReaction(tortilla.myVote.reaction ?? null);
    }
  }, [tortilla?.id, tortilla?.myVote]);

  const [castVote, { loading: voting }] = useMutation(CAST_VOTE_MUTATION, {
    refetchQueries: [
      { query: CURRENT_TORTILLA_QUERY },
      { query: TORTILLAS_QUERY },
    ],
    awaitRefetchQueries: true,
  });

  const [closeVoting, { loading: closing }] = useMutation(
    CLOSE_TORTILLA_VOTING_MUTATION,
    {
      refetchQueries: [
        { query: CURRENT_TORTILLA_QUERY },
        { query: TORTILLAS_QUERY },
      ],
      awaitRefetchQueries: true,
    }
  );

  async function handleClose() {
    if (!tortilla) return;
    const password = window.prompt(t('vote.close.passwordPrompt'));
    if (!password) return;
    setFeedback(null);
    try {
      await closeVoting({
        variables: { id: tortilla.id, adminPassword: password },
      });
      setFeedback(t('vote.close.success'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  const formattedDate = useMemo(() => {
    if (!tortilla) return '';
    try {
      return new Date(tortilla.date).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return tortilla.date;
    }
  }, [tortilla, locale]);

  async function handleSubmit() {
    if (!tortilla || !userName) return;
    setFeedback(null);
    try {
      await castVote({
        variables: {
          input: { tortillaId: tortilla.id, score, reaction },
        },
      });
      setFeedback(t('vote.success'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  if (!isReady || !userName) return null;

  if (loading && !data) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }
  if (error) {
    return (
      <div className={styles.errorBox}>
        {t('vote.errorLoading')} {error.message}{' '}
        <button onClick={() => refetch()} className={styles.retry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (!tortilla) {
    return (
      <div className={styles.emptyCard}>
        <p className={styles.emptyTitle}>{t('vote.empty.title')}</p>
        <p className={styles.emptySubtitle}>{t('vote.empty.subtitle')}</p>
      </div>
    );
  }

  const isError = feedback?.startsWith(t('common.errorPrefix'));

  return (
    <div className={styles.wrap}>
    <div className={styles.grid}>
      <div className={styles.imageCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tortilla.imageUrl}
          alt={tortilla.name}
          className={styles.image}
        />
        <div className={styles.imageBody}>
          <h2 className={styles.tortillaName}>{tortilla.name}</h2>
          <p className={styles.dateText}>{formattedDate}</p>
          {tortilla.description ? (
            <p className={styles.description}>{tortilla.description}</p>
          ) : null}
          <div className={styles.metaRow}>
            <span>
              {t('vote.average')}{' '}
              <strong>
                {tortilla.averageScore !== null
                  ? tortilla.averageScore.toFixed(2)
                  : '—'}
              </strong>
            </span>
            <span>
              {t('vote.votes')} <strong>{tortilla.voteCount}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.voteCard}>
        <h3 className={styles.voteTitle}>{t('vote.title')}</h3>
        {tortilla.votingOpen ? (
          <>
            {tortilla.myVote ? (
              <p className={styles.voteHelper}>
                {t('vote.alreadyVoted', {
                  score: tortilla.myVote.score.toFixed(1),
                })}
              </p>
            ) : (
              <p className={styles.voteHelper}>{t('vote.helper')}</p>
            )}
            <VoteSlider value={score} onChange={setScore} disabled={voting} />
            <ReactionPicker
              value={reaction}
              onChange={setReaction}
              disabled={voting}
            />
            <button
              className={styles.voteButton}
              onClick={handleSubmit}
              disabled={voting}
            >
              {voting
                ? t('vote.submitting')
                : tortilla.myVote
                  ? t('vote.update')
                  : t('vote.send')}
            </button>
            <button
              type="button"
              className={styles.closeLink}
              onClick={handleClose}
              disabled={closing}
            >
              {closing ? t('vote.close.closing') : t('vote.close.button')}
            </button>
          </>
        ) : (
          <div className={styles.closedNotice}>
            <p className={styles.closedTitle}>{t('vote.close.closedTitle')}</p>
            {tortilla.myVote ? (
              <p className={styles.voteHelper}>
                {t('vote.close.yourFinalScore', {
                  score: tortilla.myVote.score.toFixed(1),
                })}
              </p>
            ) : null}
          </div>
        )}
        {feedback ? (
          <p
            className={
              isError
                ? `${styles.feedback} ${styles.feedbackError}`
                : `${styles.feedback} ${styles.feedbackSuccess}`
            }
          >
            {feedback}
          </p>
        ) : null}
      </div>
    </div>

      <CommentsSection
        tortillaId={tortilla.id}
        comments={tortilla.comments}
        onChanged={() => refetch()}
      />
    </div>
  );
}
