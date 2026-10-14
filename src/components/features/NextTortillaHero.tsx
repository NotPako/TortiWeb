'use client';

import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { useLanguage } from '@/components/LanguageContext';
import {
  TORTILLA_DATES_QUERY,
  UPCOMING_TORTILLA_QUERY,
} from '@/graphql/operations';
import { daysUntil, isSameDay, nextWednesday } from '@/lib/dates';
import styles from './NextTortillaHero.module.css';

type UpcomingEvent = { id: string; date: string; open: boolean };

/**
 * Estado vacío de Votar: cuánto falta para la próxima tortilla. Si hay
 * convocatoria abierta cuenta hasta su fecha; si no, hasta el próximo
 * miércoles (y lo dice, porque aún no es oficial).
 */
export function NextTortillaHero() {
  const { t, locale } = useLanguage();
  // Misma consulta que `UpcomingTortillaCard`: Apollo la sirve de caché.
  const { data } = useQuery<{ upcomingTortilla: UpcomingEvent | null }>(
    UPCOMING_TORTILLA_QUERY,
    { fetchPolicy: 'cache-and-network' }
  );
  const { data: dates } = useQuery<{ tortillas: { id: string; date: string }[] }>(
    TORTILLA_DATES_QUERY
  );
  const event = data?.upcomingTortilla?.open ? data.upcomingTortilla : null;

  // Si hoy ya hubo tortilla (y está cerrada, porque estamos aquí), la
  // próxima no es "hoy": es la de la semana que viene.
  const now = new Date();
  const todayDone = (dates?.tortillas ?? []).some((tt) =>
    isSameDay(new Date(tt.date), now)
  );
  const fallback = nextWednesday(
    todayDone ? new Date(now.getTime() + 86_400_000) : now
  );
  const target = event ? new Date(event.date) : fallback;
  const days = Math.max(0, daysUntil(target));

  const when =
    days === 0
      ? t('vote.countdown.today')
      : days === 1
        ? t('vote.countdown.tomorrow')
        : t('vote.countdown.days', { n: days });

  const dateLabel = target.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section className={styles.hero}>
      <span className={styles.pan} aria-hidden>
        🍳
      </span>
      <h1 className={styles.title}>
        {todayDone ? t('vote.empty.doneTitle') : t('vote.empty.title')}
      </h1>
      <p className={styles.subtitle}>
        {todayDone ? t('vote.empty.doneSubtitle') : t('vote.empty.subtitle')}
      </p>

      <div className={styles.countdown}>
        <span className={styles.countdownLabel}>
          {t('vote.countdown.label')}
        </span>
        <span className={styles.countdownValue}>{when}</span>
        <span className={styles.countdownDate}>
          {dateLabel}
          {event ? null : ` · ${t('vote.countdown.unannounced')}`}
        </span>
      </div>

      <Link href="/history" className={styles.historyLink}>
        {t('vote.empty.historyLink')} →
      </Link>
    </section>
  );
}
