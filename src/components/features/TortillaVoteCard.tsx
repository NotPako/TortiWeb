'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import { VoteSlider } from '@/components/VoteSlider';
import { AvgPill } from '@/components/AvgPill';
import { ReactionPicker } from './ReactionPicker';
import { CommentsSection, type CommentItem } from './CommentsSection';
import type { Reaction } from '@/models/Vote';
import { fmt } from '@/lib/format';
import {
  CAST_VOTE_MUTATION,
  CLOSE_TORTILLA_VOTING_MUTATION,
  CURRENT_TORTILLAS_QUERY,
  TORTILLAS_QUERY,
} from '@/graphql/operations';
import styles from './TortillaVoteCard.module.css';

export type VotableTortilla = {
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

type Props = {
  tortilla: VotableTortilla;
  isAdmin: boolean;
  /** Refresca la query padre tras votar, cerrar o comentar. */
  onChanged: () => void | Promise<unknown>;
  /**
   * Etiqueta de la jornada ("mié · 17 jun"). La calcula el padre una vez, ya
   * que todas las tortillas de la tanda comparten día.
   */
  eyebrowDate: string;
};

/**
 * Una tortilla votable: identidad, panel de voto y sus comentarios.
 *
 * Cada tarjeta posee su propio estado de voto, que es lo que permite tener
 * varias en pantalla el mismo día sin que se pisen entre ellas.
 */
export function TortillaVoteCard({
  tortilla,
  isAdmin,
  onChanged,
  eyebrowDate,
}: Props) {
  const { t } = useLanguage();
  const [score, setScore] = useState(tortilla.myVote?.score ?? 7);
  const [reaction, setReaction] = useState<Reaction | null>(
    tortilla.myVote?.reaction ?? null
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const myVoteId = tortilla.myVote?.id ?? null;
  useEffect(() => {
    if (tortilla.myVote) {
      setScore(tortilla.myVote.score);
      setReaction(tortilla.myVote.reaction ?? null);
    }
    // Depende del voto concreto: al refrescar tras votar queremos reflejar el
    // valor guardado, no pisar lo que el usuario esté ajustando.
  }, [tortilla.id, myVoteId]);

  const { slug } = useCurrentGroup();
  const refetchQueries = useMemo(
    () => [
      { query: CURRENT_TORTILLAS_QUERY, variables: { groupSlug: slug } },
      { query: TORTILLAS_QUERY, variables: { groupSlug: slug } },
    ],
    [slug]
  );

  const [castVote, { loading: voting }] = useMutation(CAST_VOTE_MUTATION, {
    refetchQueries,
    awaitRefetchQueries: true,
  });

  const [closeVoting, { loading: closing }] = useMutation(
    CLOSE_TORTILLA_VOTING_MUTATION,
    { refetchQueries, awaitRefetchQueries: true }
  );

  async function handleSubmit() {
    setFeedback(null);
    try {
      await castVote({
        variables: { input: { tortillaId: tortilla.id, score, reaction } },
      });
      setSubmitted(true);
      window.setTimeout(() => setSubmitted(false), 2400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  async function handleClose() {
    setFeedback(null);
    try {
      await closeVoting({ variables: { id: tortilla.id } });
      setFeedback(t('vote.close.success'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  const isError = feedback?.startsWith(t('common.errorPrefix'));
  const hint = tortilla.myVote
    ? t('vote.alreadyVoted', { score: fmt(tortilla.myVote.score) })
    : t('vote.helper');

  return (
    <section className={styles.card}>
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

          <h2 className={styles.title}>{tortilla.name}</h2>

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
          <h3 className={styles.panelTitle}>{t('vote.title')}</h3>

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
                  submitted ? `${styles.cta} ${styles.ctaSuccess}` : styles.cta
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

              {isAdmin ? (
                <button
                  type="button"
                  className={styles.closeLink}
                  onClick={handleClose}
                  disabled={closing}
                >
                  {closing ? t('vote.close.closing') : t('vote.close.button')}
                </button>
              ) : null}
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
        onChanged={onChanged}
      />
    </section>
  );
}
