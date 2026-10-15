'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Skeleton } from 'antd';
import {
  ANNOUNCE_TORTILLA_MUTATION,
  CLOSE_TORTILLA_EVENT_MUTATION,
  REVIEW_SPOT_REQUEST_MUTATION,
  UPCOMING_TORTILLA_QUERY,
} from '@/graphql/operations';
import {
  DEFAULT_EVENT_CAPACITY,
  MAX_EVENT_CAPACITY,
  MIN_EVENT_CAPACITY,
} from '@/lib/eventSpots';
import { useLanguage } from './LanguageContext';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import { UserChip } from './features/UserChip';
import {
  AttendeeAllergiesAlert,
  type AttendeeWithAllergies,
} from './features/AttendeeAllergiesAlert';
import styles from './TortillaEventAdmin.module.css';

type TortillaEvent = {
  id: string;
  date: string;
  note: string | null;
  attendeeCount: number;
  capacity: number;
  open: boolean;
  attendees: (AttendeeWithAllergies & { imageUrl: string | null })[];
  pendingRequests:
    | { userId: string; userName: string; imageUrl: string | null; requestedAt: string }[]
    | null;
};

/** Fecha (yyyy-mm-dd) del próximo miércoles, para el valor por defecto del input. */
function nextWednesdayInputValue(): string {
  const d = new Date();
  const diff = (3 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  // Ajuste a fecha local en formato yyyy-mm-dd (sin desfase por toISOString UTC).
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function TortillaEventAdmin() {
  const { t, locale } = useLanguage();
  const { slug } = useCurrentGroup();
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string>(nextWednesdayInputValue());
  const [capacity, setCapacity] = useState<string>(String(DEFAULT_EVENT_CAPACITY));
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, loading } = useQuery<{ upcomingTortilla: TortillaEvent | null }>(
    UPCOMING_TORTILLA_QUERY,
    { variables: { groupSlug: slug }, skip: !slug }
  );
  const refetchUpcoming = {
    refetchQueries: [{ query: UPCOMING_TORTILLA_QUERY, variables: { groupSlug: slug } }],
    awaitRefetchQueries: true,
  };
  const event = data?.upcomingTortilla ?? null;

  const [announce, { loading: announcing }] = useMutation(
    ANNOUNCE_TORTILLA_MUTATION,
    refetchUpcoming
  );
  const [reviewRequest, { loading: reviewing }] = useMutation(
    REVIEW_SPOT_REQUEST_MUTATION
  );
  const [closeEvent, { loading: closing }] = useMutation(
    CLOSE_TORTILLA_EVENT_MUTATION,
    refetchUpcoming
  );

  function formatDate(d: string) {
    try {
      return new Date(d).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return d;
    }
  }

  async function handleAnnounce(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      await announce({
        variables: {
          input: {
            groupSlug: slug,
            date: date ? new Date(date).toISOString() : null,
            note: note.trim() || null,
            capacity: Number(capacity),
          },
        },
      });
      setFeedback(t('event.admin.success'));
      setNote('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  async function handleReview(userId: string, approve: boolean) {
    if (!event) return;
    setFeedback(null);
    try {
      await reviewRequest({
        variables: { eventId: event.id, userId, approve },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  async function handleClose() {
    if (!event) return;
    if (!window.confirm(t('event.admin.closeConfirm'))) return;
    setFeedback(null);
    try {
      await closeEvent({ variables: { id: event.id } });
      setFeedback(t('event.admin.closed'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  const isError = feedback?.startsWith(t('common.errorPrefix'));

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t('event.admin.title')}</h2>
      <p className={styles.subtitle}>{t('event.admin.subtitle')}</p>

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : event && event.open ? (
        <div className={styles.openBox}>
          <p className={styles.openTitle}>{t('event.admin.openTitle')}</p>
          <p className={styles.openMeta}>
            {t('event.admin.openFor', { date: formatDate(event.date) })} ·{' '}
            {t('event.admin.spots', {
              n: event.attendeeCount,
              capacity: event.capacity,
            })}
          </p>
          {event.note ? <p className={styles.openNote}>“{event.note}”</p> : null}

          {event.pendingRequests && event.pendingRequests.length > 0 ? (
            <div className={styles.requests}>
              <p className={styles.requestsTitle}>
                {t('event.admin.requestsTitle', {
                  n: event.pendingRequests.length,
                })}
              </p>
              <p className={styles.requestsHint}>{t('event.admin.requestsHint')}</p>
              <ol className={styles.requestList}>
                {event.pendingRequests.map((r) => (
                  <li key={r.userId} className={styles.requestRow}>
                    <UserChip userName={r.userName} imageUrl={r.imageUrl} size={28} />
                    <span className={styles.requestActions}>
                      <button
                        type="button"
                        className={styles.approve}
                        onClick={() => handleReview(r.userId, true)}
                        disabled={reviewing}
                      >
                        {t('event.admin.approve')}
                      </button>
                      <button
                        type="button"
                        className={styles.reject}
                        onClick={() => handleReview(r.userId, false)}
                        disabled={reviewing}
                      >
                        {t('event.admin.reject')}
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <AttendeeAllergiesAlert attendees={event.attendees} />
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className={styles.closeButton}
          >
            {closing ? t('event.admin.closing') : t('event.admin.close')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleAnnounce} className={styles.form}>
          <div>
            <label className={styles.label} htmlFor="ev-date">
              {t('event.admin.dateLabel')}
            </label>
            <input
              id="ev-date"
              type="date"
              className={styles.input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={styles.label} htmlFor="ev-capacity">
              {t('event.admin.capacityLabel')}
            </label>
            <input
              id="ev-capacity"
              type="number"
              inputMode="numeric"
              min={MIN_EVENT_CAPACITY}
              max={MAX_EVENT_CAPACITY}
              step={1}
              className={`${styles.input} ${styles.inputNarrow}`}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
            <p className={styles.fieldHint}>{t('event.admin.capacityHint')}</p>
          </div>
          <div>
            <label className={styles.label} htmlFor="ev-note">
              {t('event.admin.noteLabel')}
            </label>
            <textarea
              id="ev-note"
              className={styles.textarea}
              placeholder={t('event.admin.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.submit} disabled={announcing}>
            {announcing ? t('event.admin.announcing') : t('event.admin.submit')}
          </button>
        </form>
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
    </section>
  );
}
