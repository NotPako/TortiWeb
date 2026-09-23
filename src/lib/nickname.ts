/**
 * Cambio de nombre de usuario (nickname).
 *
 * El nombre es solo una etiqueta: la identidad de una cuenta es su id, y los
 * votos y comentarios cuelgan de ese id. Por eso renombrarse no pierde el
 * historial, y por eso el nombre antiguo queda libre para quien lo quiera.
 *
 * El número de cambios es limitado para que el resto de la peña siga sabiendo
 * quién es quién de una semana a otra.
 */

export const MAX_NICKNAME_CHANGES = 3;

/** 2-20 caracteres: letras, números, punto, guion y guion bajo. */
export const NICKNAME_RE = /^[A-Za-z0-9._-]{2,20}$/;

export function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
}

/** Recorta y valida el formato. Lanza si no es válido. */
export function validateNickname(value: string): string {
  const trimmed = value.trim();
  if (!NICKNAME_RE.test(trimmed)) {
    throw new Error(
      'El usuario debe tener entre 2 y 20 caracteres y solo letras, números, _, - o .'
    );
  }
  return trimmed;
}

export function nicknameChangesLeft(used: number): number {
  return Math.max(0, MAX_NICKNAME_CHANGES - used);
}

export type NicknameChangeKind =
  /** Mismo nombre exacto: no hay nada que hacer. */
  | 'unchanged'
  /** Solo cambian mayúsculas ("pako" → "Pako"): no gasta ningún cambio. */
  | 'caseOnly'
  /** Nombre distinto: gasta uno de los cambios disponibles. */
  | 'rename';

export type NicknameChange = {
  kind: NicknameChangeKind;
  /** Nombre ya recortado y validado. */
  username: string;
  /** Clave normalizada correspondiente. */
  usernameKey: string;
};

/**
 * Decide qué supone cambiar `current` por `requested`, con `used` cambios ya
 * gastados. Lanza si el formato no vale o si no quedan cambios.
 *
 * Corregir mayúsculas no gasta cambio: no altera a quién apunta nada ni cómo
 * te encuentran los demás, y cobrarlo sería una sorpresa desagradable.
 */
export function planNicknameChange(input: {
  current: string;
  requested: string;
  used: number;
}): NicknameChange {
  const username = validateNickname(input.requested);
  const usernameKey = normalizeNickname(username);

  if (username === input.current) {
    return { kind: 'unchanged', username, usernameKey };
  }
  if (usernameKey === normalizeNickname(input.current)) {
    return { kind: 'caseOnly', username, usernameKey };
  }
  if (nicknameChangesLeft(input.used) === 0) {
    throw new Error(
      `Ya has cambiado de nombre ${MAX_NICKNAME_CHANGES} veces: no te quedan más cambios.`
    );
  }
  return { kind: 'rename', username, usernameKey };
}
