'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { useLanguage } from '@/components/LanguageContext';
import { useUser } from '@/components/UserContext';
import {
  MARK_ACHIEVEMENTS_SEEN_MUTATION,
  NEW_ACHIEVEMENTS_QUERY,
} from '@/graphql/operations';
import type { TranslationKey } from '@/lib/i18n';
import type { AchievementItem } from './AchievementsGrid';
import styles from './AchievementUnlockToast.module.css';

/**
 * El "bloop" del aviso: dos notas cortas sintetizadas, sin ficheros de audio.
 * Si el navegador bloquea el audio (sin interacción previa), se queda mudo.
 */
function playUnlockSound() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [
      { freq: 783.99, at: 0 },
      { freq: 1174.66, at: 0.11 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(0.08, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.5);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Sin audio no pasa nada.
  }
}

/**
 * Aviso de "logro desbloqueado" al estilo Xbox. Vive en el layout: consulta
 * los logros nuevos al cargar y cada vez que se vota (`castVote` refresca
 * `NewAchievements`), y los muestra de uno en uno.
 */
export function AchievementUnlockToast() {
  const { userName } = useUser();
  const { t } = useLanguage();
  const router = useRouter();
  const [queue, setQueue] = useState<AchievementItem[]>([]);
  // Lo ya encolado en esta pestaña: la consulta puede volver a traerlo antes
  // de que el servidor registre que se ha visto.
  const handled = useRef(new Set<string>());

  const { data } = useQuery<{ newAchievements: AchievementItem[] }>(
    NEW_ACHIEVEMENTS_QUERY,
    { skip: !userName, fetchPolicy: 'network-only' }
  );
  const [markSeen] = useMutation(MARK_ACHIEVEMENTS_SEEN_MUTATION);

  useEffect(() => {
    const fresh = (data?.newAchievements ?? []).filter(
      (a) => !handled.current.has(a.id)
    );
    if (fresh.length === 0) return;
    fresh.forEach((a) => handled.current.add(a.id));
    setQueue((q) => [...q, ...fresh]);
    // Se marca al encolar: si cierra la pestaña a medias, no se repite.
    markSeen({ variables: { ids: fresh.map((a) => a.id) } }).catch(() => {});
  }, [data, markSeen]);

  const current = queue[0];

  useEffect(() => {
    if (current) playUnlockSound();
  }, [current]);

  if (!current) return null;

  const next = () => setQueue((q) => q.slice(1));

  function handleAnimationEnd(e: AnimationEvent<HTMLButtonElement>) {
    // Las animaciones de los hijos también burbujean hasta aquí.
    if (e.target === e.currentTarget) next();
  }

  const title = t(`achievement.${current.id}.title` as TranslationKey);

  return (
    <div className={styles.anchor} role="status" aria-live="polite">
      <button
        key={current.id}
        type="button"
        className={
          current.hidden ? `${styles.toast} ${styles.toastSecret}` : styles.toast
        }
        onAnimationEnd={handleAnimationEnd}
        onClick={() => {
          next();
          router.push('/profile');
        }}
      >
        <span className={styles.badge} aria-hidden>
          <span className={styles.ring} />
          <span className={styles.emoji}>{current.emoji}</span>
        </span>
        <span className={styles.text}>
          <span className={styles.kicker}>
            {current.hidden
              ? `🤫 ${t('achievement.secretUnlockedToast')}`
              : `🏆 ${t('achievement.unlockedToast')}`}
          </span>
          <span className={styles.title}>{title}</span>
        </span>
      </button>
    </div>
  );
}
