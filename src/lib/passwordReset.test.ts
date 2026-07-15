import { describe, it, expect } from 'vitest';
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  isResetTokenExpired,
  resetTokenExpiry,
  resetTokenMatches,
} from './passwordReset';

describe('generateResetToken', () => {
  it('genera tokens únicos de 64 hex chars', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token).not.toBe(b.token);
  });

  it('el hash guardado no es el token en claro', () => {
    const { token, tokenHash } = generateResetToken();
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toBe(hashResetToken(token));
  });
});

describe('resetTokenMatches', () => {
  it('acepta el token original', () => {
    const { token, tokenHash } = generateResetToken();
    expect(resetTokenMatches(token, tokenHash)).toBe(true);
  });

  it('rechaza un token distinto', () => {
    const { tokenHash } = generateResetToken();
    const other = generateResetToken();
    expect(resetTokenMatches(other.token, tokenHash)).toBe(false);
  });

  it('rechaza hashes de longitud incorrecta sin lanzar', () => {
    const { token } = generateResetToken();
    expect(resetTokenMatches(token, 'abcd')).toBe(false);
  });
});

describe('expiración', () => {
  it('resetTokenExpiry devuelve now + TTL', () => {
    const now = new Date(2026, 4, 17, 12, 0, 0);
    const expiry = resetTokenExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(RESET_TOKEN_TTL_MS);
  });

  it('isResetTokenExpired es false antes del límite', () => {
    const now = new Date(2026, 4, 17, 12, 0, 0);
    const expiry = resetTokenExpiry(now);
    const before = new Date(expiry.getTime() - 1000);
    expect(isResetTokenExpired(expiry, before)).toBe(false);
  });

  it('isResetTokenExpired es true en o después del límite', () => {
    const now = new Date(2026, 4, 17, 12, 0, 0);
    const expiry = resetTokenExpiry(now);
    expect(isResetTokenExpired(expiry, expiry)).toBe(true);
    expect(isResetTokenExpired(null, now)).toBe(true);
    expect(isResetTokenExpired(undefined, now)).toBe(true);
  });
});
