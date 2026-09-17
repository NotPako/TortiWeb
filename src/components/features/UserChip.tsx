'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { groupProfilePath } from '@/lib/groups';
import { Avatar, Image } from 'antd';
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
   * Destino del enlace. Por defecto, el perfil de `userName` dentro del grupo
   * de la ruta actual (fuera de un grupo, sin enlace: los perfiles solo
   * existen dentro de un grupo compartido).
   * `null` renderiza el chip sin enlazar (p. ej. en el propio perfil).
   */
  href?: string | null;
  /** Se ejecuta al navegar. Útil para cerrar el modal que contiene el chip. */
  onNavigate?: () => void;
  /**
   * Al pulsar el avatar, abre la foto a tamaño completo. Solo tiene efecto si
   * el usuario tiene foto: con la inicial de respaldo no hay nada que ampliar.
   * Incompatible con enlazar, así que se usa junto a `href={null}`.
   */
  previewable?: boolean;
  /** Etiqueta accesible del disparador de la vista previa. */
  previewLabel?: string;
  /** Etiqueta accesible. Solo necesaria si `showName` es `false`. */
  ariaLabel?: string;
  className?: string;
};


export function UserChip({
  userName,
  imageUrl,
  size = 32,
  showName = true,
  href,
  onNavigate,
  previewable = false,
  previewLabel,
  ariaLabel,
  className,
}: Props) {
  const params = useParams<{ slug?: string | string[] }>();
  const groupSlug = typeof params?.slug === 'string' ? params.slug : null;
  const defaultHref = groupSlug ? groupProfilePath(groupSlug, userName) : null;
  const target = href === undefined ? defaultHref : href;
  const [previewOpen, setPreviewOpen] = useState(false);
  const canPreview = previewable && Boolean(imageUrl);

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

  if (canPreview) {
    return (
      <span className={rootClass}>
        <button
          type="button"
          className={styles.previewTrigger}
          onClick={() => setPreviewOpen(true)}
          aria-label={previewLabel ?? userName}
        >
          {avatar}
        </button>
        {showName ? <span className={styles.name}>{userName}</span> : null}
        {/*
          ANTD abre el visor desde su propio <Image>. Lo dejamos oculto y lo
          controlamos a mano para no perder el Avatar (gradiente + inicial).
        */}
        <Image
          src={imageUrl ?? undefined}
          alt={userName}
          style={{ display: 'none' }}
          preview={{
            visible: previewOpen,
            onVisibleChange: setPreviewOpen,
          }}
        />
      </span>
    );
  }

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
