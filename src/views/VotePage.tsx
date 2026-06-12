'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { Skeleton } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { VoteSlider } from '@/components/VoteSlider';
import { AvgPill } from '@/components/AvgPill';
import { ReactionPicker } from '@/components/features/ReactionPicker';
import {
  CommentsSection,
  type CommentItem,
} from '@/components/features/CommentsSection';
import type { Reaction } from '@/models/Vote';
import { fmt } from '@/lib/format';
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
  const [submitted, setSubmitted] = useState(false);

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

  const eyebrowDate = useMemo(() => {
    if (!tortilla) return '';
    try {
      const d = new Date(tortilla.date);
      const weekday = d
        .toLocaleDateString(locale, { weekday: 'short' })
        .replace('.', '');
      const day = d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      });
      return `${weekday} · ${day}`;
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
      setSubmitted(true);
      window.setTimeout(() => setSubmitted(false), 2400);
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
  const hint = tortilla.myVote
    ? t('vote.alreadyVoted', { score: fmt(tortilla.myVote.score) })
    : t('vote.helper');

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* Columna izquierda: identidad de la tortilla */}
        <div className={styles.identityCol}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            <span className={styles.eyebrowText}>
              {eyebrowDate} · {t('vote.eyebrow')}
            </span>
          </div>

          <div className={styles.photoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tortilla.imageUrl}
              alt={tortilla.name}
              className={styles.photo}
            />
          </div>

          <h1 className={styles.title}>{tortilla.name}</h1>

          <AvgPill
            average={tortilla.averageScore}
            voteCount={tortilla.voteCount}
            size="lg"
          />

          {tortilla.description ? (
            <p className={styles.description}>{tortilla.description}</p>
          ) : null}
        </div>

        {/* Columna derecha: panel de votación */}
        <div className={styles.votePanel}>
          <h2 className={styles.panelTitle}>{t('vote.title')}</h2>

          {tortilla.votingOpen ? (
            <>
              <VoteSlider
                value={score}
                onChange={setScore}
                disabled={voting}
                hint={hint}
              />

              <div className={styles.divider} />

              <ReactionPicker
                value={reaction}
                onChange={setReaction}
                disabled={voting}
              />

              <button
                type="button"
                className={
                  submitted
                    ? `${styles.cta} ${styles.ctaSuccess}`
                    : styles.cta
                }
                onClick={handleSubmit}
                disabled={voting}
              >
                {submitted
                  ? `✓ ${t('vote.success')}`
                  : voting
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
              <p className={styles.closedTitle}>
                {t('vote.close.closedTitle')}
              </p>
              {tortilla.myVote ? (
                <p className={styles.closedHint}>
                  {t('vote.close.yourFinalScore', {
                    score: fmt(tortilla.myVote.score),
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
