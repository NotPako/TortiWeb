'use client';

import { useEffect, useState } from 'react';
import styles from './TortillaImage.module.css';

type Props = {
  src: string | null | undefined;
  alt: string;
  /** Tamaño y forma: se aplica igual a la foto y al respaldo. */
  className?: string;
  loading?: 'lazy' | 'eager';
};

/**
 * Foto de una tortilla con respaldo: si no hay URL o la imagen no carga, en
 * vez del icono roto del navegador se ve un fondo de la marca con 🍳.
 */
export function TortillaImage({ src, alt, className, loading }: Props) {
  const [failed, setFailed] = useState(false);

  // Si cambia la foto (otra tortilla en la misma tarjeta), se vuelve a probar.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={className ? `${styles.fallback} ${className}` : styles.fallback}
        role="img"
        aria-label={alt}
      >
        <span className={styles.icon} aria-hidden>
          🍳
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className ? `${styles.photo} ${className}` : styles.photo}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
