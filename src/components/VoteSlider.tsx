'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { fmt } from '@/lib/format';
import styles from './VoteSlider.module.css';

type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Tamaño en px del número grande. 44 en móvil, 52 en desktop. */
  bigSize?: number;
  /** Texto opcional bajo el label. Ej: "Ya votaste un 7,5 · puedes cambiarlo". */
  hint?: string | null;
};

const MIN = 0;
const MAX = 10;

function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(n * 10) / 10));
}

export function VoteSlider({
  value,
  onChange,
  disabled = false,
  bigSize = 44,
  hint,
}: Props) {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef(false);

  const fraction = (value - MIN) / (MAX - MIN);

  function setFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let f = (clientX - rect.left) / rect.width;
    f = Math.max(0, Math.min(1, f));
    onChange(clamp(MIN + f * (MAX - MIN)));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.preventDefault();
    try {
      trackRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    movingRef.current = true;
    setFromClientX(e.clientX);
  }

  useEffect(() => {
    if (disabled) return;
    function handleMove(ev: PointerEvent) {
      if (!movingRef.current) return;
      setFromClientX(ev.clientX);
    }
    function handleUp() {
      movingRef.current = false;
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function step(delta: number) {
    if (disabled) return;
    onChange(clamp(value + delta));
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <div className={styles.headerLabel}>
          <div className={styles.eyebrow}>{t('slider.label')}</div>
          {hint ? <div className={styles.hint}>{hint}</div> : null}
        </div>
        <div className={styles.stepperRow}>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => step(-0.1)}
            disabled={disabled || value <= MIN}
            aria-label="-0.1"
          >
            –
          </button>
          <div
            className={styles.bigValue}
            style={{
              fontSize: bigSize,
              minWidth: bigSize * 1.5,
            }}
          >
            {fmt(value)}
          </div>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => step(0.1)}
            disabled={disabled || value >= MAX}
            aria-label="+0.1"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className={styles.sliderTrack}
        onPointerDown={handlePointerDown}
        role="slider"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            step(-0.1);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            step(0.1);
          }
        }}
      >
        <div className={styles.trackBg} />
        <div
          className={styles.trackFill}
          style={{ width: `${fraction * 100}%` }}
        />
        <div
          className={styles.thumb}
          style={{ left: `${fraction * 100}%` }}
        />
      </div>

      <div className={styles.endpoints}>
        <span>0</span>
        <span>10</span>
      </div>
    </div>
  );
}
