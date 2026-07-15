import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Vida útil del token de reseteo: 1 hora. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Genera un token de reseteo. El `token` (claro) viaja en el enlace del email;
 * en la BD solo se guarda `tokenHash`, para que un volcado de la BD no permita
 * resetear contraseñas ajenas.
 */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparación en tiempo constante para evitar timing attacks. */
export function resetTokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashResetToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function resetTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS);
}

export function isResetTokenExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}
