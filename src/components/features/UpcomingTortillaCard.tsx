'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Avatar } from 'antd';
import {
  SET_ATTENDANCE_MUTATION,
  UPCOMING_TORTILLA_QUERY,
} from '@/graphql/operations';
import { useLanguage } from '../LanguageContext';
import styles from './UpcomingTortillaCard.module.css';

type Attendee = { userName: string; imageUrl: string | null };
type TortillaEvent = {
  id: string;
  date: string;
  note: string | null;
  attendeeCount: number;
  isAttending: boolean;
  open: boolean;
  attendees: Attendee[];
};

const avatarGradient = {
  background:
    'linear-gradient(135deg, var(--c-amber-lite), var(--c-amber-deep))',
  color: 'white',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
} as const;

export function UpcomingTortillaCard() {
  const { t, locale } = useLanguage();
  const { data } = useQuery<{ upcomingTortilla: TortillaEvent | null }>(
    UPCOMING_TORTILLA_QUERY,
    { fetchPolicy: 'cache-and-network' }
  );
  const [setAttendance, { loading }] = useMutation(SET_ATTENDANCE_MUTATION);

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

  async function toggle() {
    if (!event) return;
    try {
      await setAttendance({
        variables: { id: event.id, attending: !event.isAttending },
      });
    } catch {
      // Errores de red: la UI no cambia; el usuario puede reintentar.
    }
  }

  const countLabel =
    event.attendeeCount === 1
      ? t('event.attendeeSingular')
      : t('event.attendeePlural');

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
        <span className={styles.count}>
          {event.attendeeCount} {countLabel}
        </span>
      </div>

      {event.attendeeCount === 0 ? (
        <p className={styles.empty}>{t('event.empty')}</p>
      ) : (
        <ul className={styles.attendees}>
          {event.attendees.map((a, i) => (
            <li key={`${a.userName}-${i}`} className={styles.attendee}>
              <Avatar src={a.imageUrl ?? undefined} size={28} style={avatarGradient}>
                {a.userName.charAt(0).toUpperCase()}
              </Avatar>
              <span className={styles.attendeeName}>{a.userName}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={
          event.isAttending
            ? `${styles.toggle} ${styles.toggleLeave}`
            : `${styles.toggle} ${styles.toggleJoin}`
        }
      >
        {loading
          ? t('event.saving')
          : event.isAttending
            ? t('event.leave')
            : t('event.join')}
      </button>
    </section>
  );
}
