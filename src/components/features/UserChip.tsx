'use client';

import Link from 'next/link';
import { Avatar } from 'antd';
import styles from './UserChip.module.css';

/**
 * Identidad de un usuario (avatar + nombre) enlazada a su perfil público.
 *
 * Es el único sitio donde se decide cómo se ve un usuario en la app: el
 * gradiente del avatar, la inicial de respaldo cuando no hay foto y la ruta
 * del perfil. Si hace falta cambiar cualquiera de esas tres cosas, se cambia
 * aquí y aplica a votos, comentarios, apuntados y navbar a la vez.
 */

type Props = {
  userName: string;
  imageUrl?: string | null;
  /** Diámetro del avatar en px. El tamaño de la inicial se deriva de este valor. */
  size?: number;
  /** `false` deja solo el avatar (navbar, cabecera de perfil). */
  showName?: boolean;
  /**
   * Destino del enlace. Por defecto, el perfil público de `userName`.
   * `null` renderiza el chip sin enlazar (p. ej. en el propio perfil).
   */
  href?: string | null;
  /** Se ejecuta al navegar. Útil para cerrar el modal que contiene el chip. */
  onNavigate?: () => void;
  /** Etiqueta accesible. Solo necesaria si `showName` es `false`. */
  ariaLabel?: string;
  className?: string;
};

export function profileHref(userName: string): string {
  return `/profile/${encodeURIComponent(userName)}`;
}

export function UserChip({
  userName,
  imageUrl,
  size = 32,
  showName = true,
  href,
  onNavigate,
  ariaLabel,
  className,
}: Props) {
  const target = href === undefined ? profileHref(userName) : href;

  const avatar = (
    <Avatar
      src={imageUrl ?? undefined}
      size={size}
      style={{
        background:
          'linear-gradient(135deg, var(--c-amber-lite), var(--c-amber-deep))',
        color: 'white',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        flexShrink: 0,
      }}
    >
      {userName.charAt(0).toUpperCase()}
    </Avatar>
  );

  const body = (
    <>
      {avatar}
      {showName ? <span className={styles.name}>{userName}</span> : null}
    </>
  );

  const rootClass = className ? `${styles.chip} ${className}` : styles.chip;

  if (!target) {
    return <span className={rootClass}>{body}</span>;
  }

  return (
    <Link
      href={target}
      onClick={onNavigate}
      className={`${rootClass} ${styles.link}`}
      // Con el nombre visible el propio texto ya nombra el enlace.
      aria-label={showName ? undefined : (ariaLabel ?? userName)}
    >
      {body}
    </Link>
  );
}
