'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Skeleton } from 'antd';
import {
  ANNOUNCE_TORTILLA_MUTATION,
  CLOSE_TORTILLA_EVENT_MUTATION,
  UPCOMING_TORTILLA_QUERY,
} from '@/graphql/operations';
import { useLanguage } from './LanguageContext';
import styles from './TortillaEventAdmin.module.css';

type TortillaEvent = {
  id: string;
  date: string;
  note: string | null;
  attendeeCount: number;
  open: boolean;
  attendees: { userName: string; imageUrl: string | null }[];
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
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string>(nextWednesdayInputValue());
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, loading } = useQuery<{ upcomingTortilla: TortillaEvent | null }>(
    UPCOMING_TORTILLA_QUERY
  );
  const event = data?.upcomingTortilla ?? null;

  const [announce, { loading: announcing }] = useMutation(
    ANNOUNCE_TORTILLA_MUTATION,
    { refetchQueries: [{ query: UPCOMING_TORTILLA_QUERY }], awaitRefetchQueries: true }
  );
  const [closeEvent, { loading: closing }] = useMutation(
    CLOSE_TORTILLA_EVENT_MUTATION,
    { refetchQueries: [{ query: UPCOMING_TORTILLA_QUERY }], awaitRefetchQueries: true }
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
            date: date ? new Date(date).toISOString() : null,
            note: note.trim() || null,
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
            {event.attendeeCount}{' '}
            {event.attendeeCount === 1
              ? t('event.attendeeSingular')
              : t('event.attendeePlural')}
          </p>
          {event.note ? <p className={styles.openNote}>“{event.note}”</p> : null}
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
