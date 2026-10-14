'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useLanguage } from '@/components/LanguageContext';
import { VoteSlider } from '@/components/VoteSlider';
import { AvgPill } from '@/components/AvgPill';
import { ReactionPicker } from './ReactionPicker';
import { CommentsSection, type CommentItem } from './CommentsSection';
import { TortillaImage } from './TortillaImage';
import { ConfettiBurst } from './ConfettiBurst';
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
  // Sube en cada voto guardado: hace saltar el número en el slider.
  const [celebrateKey, setCelebrateKey] = useState(0);
  // Un 10 se celebra con confeti desde el botón.
  const [confettiFrom, setConfettiFrom] = useState<{ x: number; y: number } | null>(
    null
  );
  const ctaRef = useRef<HTMLButtonElement>(null);

  const myVoteId = tortilla.myVote?.id ?? null;
  useEffect(() => {
    if (tortilla.myVote) {
      setScore(tortilla.myVote.score);
      setReaction(tortilla.myVote.reaction ?? null);
    }
    // Depende del voto concreto: al refrescar tras votar queremos reflejar el
    // valor guardado, no pisar lo que el usuario esté ajustando.
  }, [tortilla.id, myVoteId]);

  const refetchQueries = useMemo(
    () => [{ query: CURRENT_TORTILLAS_QUERY }, { query: TORTILLAS_QUERY }],
    []
  );

  const [castVote, { loading: voting }] = useMutation(CAST_VOTE_MUTATION, {
    // Por nombre: solo se refresca si el aviso de logros está montado.
    refetchQueries: [...refetchQueries, 'NewAchievements'],
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
      setCelebrateKey((k) => k + 1);
      if (score >= 10) {
        const rect = ctaRef.current?.getBoundingClientRect();
        if (rect) {
          setConfettiFrom({ x: rect.left + rect.width / 2, y: rect.top });
        }
      }
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
      {/* Cabecera tipo ficha: la foto manda y el nombre va encima. */}
      <header className={styles.hero}>
        <TortillaImage
          src={tortilla.imageUrl}
          alt={tortilla.name}
          className={styles.photo}
        />
        <div className={styles.heroShade} aria-hidden />
        <div className={styles.heroText}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            <span className={styles.eyebrowText}>
              {eyebrowDate} · {t('vote.eyebrow')}
            </span>
          </div>
          <h2 className={styles.title}>{tortilla.name}</h2>
          <AvgPill
            average={tortilla.averageScore}
            voteCount={tortilla.voteCount}
            size="lg"
            onPhoto
          />
        </div>
      </header>

      {tortilla.description ? (
        <p className={styles.description}>{tortilla.description}</p>
      ) : null}

      <div className={styles.grid}>
        {/* Panel de votación; en escritorio, los comentarios al lado. */}
        <div className={styles.votePanel}>
          <h3 className={styles.panelTitle}>{t('vote.title')}</h3>

          {tortilla.votingOpen ? (
            <>
              <VoteSlider
                value={score}
                onChange={setScore}
                disabled={voting}
                hint={hint}
                celebrateKey={celebrateKey}
              />

              <div className={styles.divider} />

              <ReactionPicker
                value={reaction}
                onChange={setReaction}
                disabled={voting}
              />

              <button
                ref={ctaRef}
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

        <CommentsSection
          tortillaId={tortilla.id}
          comments={tortilla.comments}
          onChanged={onChanged}
        />
      </div>

      {confettiFrom ? (
        <ConfettiBurst
          origin={confettiFrom}
          onDone={() => setConfettiFrom(null)}
        />
      ) : null}

    </section>
  );
}
