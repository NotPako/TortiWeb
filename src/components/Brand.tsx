'use client';

import { useId } from 'react';
import styles from './Brand.module.css';

type BrandmarkProps = {
  size?: number;
  ring?: boolean;
};

// React 18 useId() devuelve ":r0:" que rompe la referencia url(#...) en SVG.
// Sanitizamos los dos puntos para producir un ID válido.
function sanitizeSvgId(id: string): string {
  return `tg-${id.replace(/:/g, '')}`;
}

export function Brandmark({ size = 30, ring = true }: BrandmarkProps) {
  const gid = sanitizeSvgId(useId());
  const sid = sanitizeSvgId(useId());
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gid} cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#ffe6a8" />
          <stop offset="48%" stopColor="#ffc24d" />
          <stop offset="100%" stopColor="#e98b15" />
        </radialGradient>
        <radialGradient id={sid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b5640a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#b5640a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${gid})`} />
      {ring ? (
        <circle
          cx="16"
          cy="16"
          r="15"
          fill="none"
          stroke="#a85c00"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
      ) : null}
      <circle cx="11" cy="12" r="2.1" fill={`url(#${sid})`} />
      <circle cx="21" cy="13.5" r="1.7" fill={`url(#${sid})`} />
      <circle cx="17" cy="20" r="2.4" fill={`url(#${sid})`} />
      <circle cx="23" cy="20.5" r="1.3" fill={`url(#${sid})`} />
      <circle cx="10" cy="19" r="1.2" fill={`url(#${sid})`} />
    </svg>
  );
}

type BrandProps = {
  size?: number;
};

export function Brand({ size = 30 }: BrandProps) {
  return (
    <span
      className={styles.brand}
      style={{ gap: size * 0.3, ['--wordmark-size' as string]: `${size * 0.62}px` }}
    >
      <Brandmark size={size} />
      <span className={styles.wordmark}>
        Torti<span className={styles.wordmarkAccent}>Web</span>
      </span>
    </span>
  );
}
