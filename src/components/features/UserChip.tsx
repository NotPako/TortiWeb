'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Avatar, Image } from 'antd';
import { useIsBirthday } from '@/components/BirthdayContext';
import { useLanguage } from '@/components/LanguageContext';
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

/** Gorro de fiesta que se apoya, ladeado, sobre el avatar. */
function BirthdayHat({ size, label }: { size: number; label: string }) {
  const width = Math.round(size * 0.62);
  // Un id por gorro: puede haber varios chips del mismo usuario en pantalla.
  const clipId = `birthday-hat-${useId().replace(/:/g, '')}`;
  return (
    <span
      className={styles.hat}
      role="img"
      aria-label={label}
      title={label}
      style={{
        width,
        height: Math.round(width * 1.2),
        top: -Math.round(size * 0.52),
        left: Math.round(size * 0.06),
      }}
    >
      <svg viewBox="0 0 40 48" width="100%" height="100%" aria-hidden>
        <defs>
          <clipPath id={clipId}>
            <path d="M20 7 L37 45 Q20 50 3 45 Z" />
          </clipPath>
        </defs>
        <path d="M20 7 L37 45 Q20 50 3 45 Z" fill="#e8467c" />
        <g clipPath={`url(#${clipId})`} fill="#ffb43c">
          <path d="M0 20 L40 12 L40 19 L0 27 Z" />
          <path d="M0 34 L40 26 L40 33 L0 41 Z" />
        </g>
        <circle cx="13" cy="31" r="1.6" fill="#fff" />
        <circle cx="25" cy="38" r="1.6" fill="#fff" />
        <circle cx="22" cy="22" r="1.4" fill="#fff" />
        <path
          d="M3 45 Q20 50 37 45"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="20" cy="6" r="5" fill="#fff8ec" stroke="#ffb43c" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

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
  previewable = false,
  previewLabel,
  ariaLabel,
  className,
}: Props) {
  const target = href === undefined ? profileHref(userName) : href;
  const [previewOpen, setPreviewOpen] = useState(false);
  const canPreview = previewable && Boolean(imageUrl);
  const isBirthday = useIsBirthday(userName);
  const { t } = useLanguage();

  const avatarImage = (
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

  // El cumpleaños se decide aquí, como el resto de la identidad del usuario:
  // así el gorro sale igual en votos, comentarios, apuntados y navbar.
  const avatar = isBirthday ? (
    <span
      className={styles.avatarWrap}
      // En listas el gorro sobresale sin mover nada; un avatar grande (cabecera
      // del perfil) suele estar pegado arriba y necesita hueco para no cortarse.
      style={size >= 64 ? { marginTop: Math.round(size * 0.3) } : undefined}
    >
      {avatarImage}
      <BirthdayHat size={size} label={t('birthday.hatLabel')} />
    </span>
  ) : (
    avatarImage
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
