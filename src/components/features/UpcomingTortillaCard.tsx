'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  SET_ATTENDANCE_MUTATION,
  UPCOMING_TORTILLA_QUERY,
} from '@/graphql/operations';
import { useLanguage } from '../LanguageContext';
import { UserChip } from './UserChip';
import styles from './UpcomingTortillaCard.module.css';

type Attendee = { userName: string; imageUrl: string | null };
type TortillaEvent = {
  id: string;
  date: string;
  note: string | null;
  attendeeCount: number;
  capacity: number;
  isAttending: boolean;
  myRequestStatus: 'PENDING' | 'REJECTED' | null;
  myQueuePosition: number | null;
  open: boolean;
  attendees: Attendee[];
};

export function UpcomingTortillaCard() {
  const { t, locale } = useLanguage();
  const { data } = useQuery<{ upcomingTortilla: TortillaEvent | null }>(
    UPCOMING_TORTILLA_QUERY,
    { fetchPolicy: 'cache-and-network' }
  );
  const [setAttendance, { loading }] = useMutation(SET_ATTENDANCE_MUTATION, {
    // "Fiel a la cita" se consigue al apuntarse.
    refetchQueries: ['NewAchievements'],
  });
  const [error, setError] = useState<string | null>(null);

  const event = data?.upcomingTortilla ?? null;
  if (!event || !event.open) return null;

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return d;
    }
  };

  // Quien está apuntado o en la cola "sale"; el resto "entra" (o pide plaza).
  const inside = event.isAttending || event.myRequestStatus === 'PENDING';

  async function toggle() {
    if (!event) return;
    setError(null);
    try {
      await setAttendance({
        variables: { id: event.id, attending: !inside },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.errorPrefix'));
    }
  }

  const full = event.attendeeCount >= event.capacity;
  const spotsLeft = Math.max(0, event.capacity - event.attendeeCount);
  const spotsLabel = full
    ? t('event.spots.full')
    : spotsLeft === 1
      ? t('event.spots.leftOne')
      : t('event.spots.left', { n: spotsLeft });
  const rejected = event.myRequestStatus === 'REJECTED';
  const pending = event.myRequestStatus === 'PENDING';

  const buttonLabel = loading
    ? t('event.saving')
    : event.isAttending
      ? t('event.leave')
      : pending
        ? t('event.request.cancel')
        : full
          ? t('event.request.send')
          : t('event.join');

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>{t('event.title')}</span>
        <span className={styles.date}>{formatDate(event.date)}</span>
      </div>

      {event.note ? <p className={styles.note}>“{event.note}”</p> : null}

      <div className={styles.attendeesHead}>
        <span className={styles.attendeesTitle}>
          {t('event.attendeesTitle')}
        </span>
        <span className={full ? `${styles.count} ${styles.countFull}` : styles.count}>
          {event.attendeeCount}/{event.capacity} · {spotsLabel}
        </span>
      </div>

      {event.attendeeCount === 0 ? (
        <p className={styles.empty}>{t('event.empty')}</p>
      ) : (
        <ul className={styles.attendees}>
          {event.attendees.map((a, i) => (
            <li key={`${a.userName}-${i}`} className={styles.attendee}>
              <UserChip
                userName={a.userName}
                imageUrl={a.imageUrl}
                size={28}
              />
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <p className={styles.notice}>
          ⏳ {t('event.request.pending', { n: event.myQueuePosition ?? 1 })}
        </p>
      ) : full && !event.isAttending && !rejected ? (
        <p className={styles.notice}>{t('event.request.explain')}</p>
      ) : null}

      {rejected ? (
        // El admin dijo que no: sin botón, no se puede volver a pedir.
        <p className={`${styles.notice} ${styles.noticeRejected}`}>
          {t('event.request.rejected')}
        </p>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={
            inside
              ? `${styles.toggle} ${styles.toggleLeave}`
              : `${styles.toggle} ${styles.toggleJoin}`
          }
        >
          {buttonLabel}
        </button>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
