import { describe, it, expect } from 'vitest';
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MAX_INVITE_DAYS,
  MAX_INVITE_USES,
  formatInviteCode,
  generateInviteCode,
  inviteStatus,
  normalizeInviteCode,
  normalizeInviteLimits,
} from './invites';

describe('generateInviteCode', () => {
  it('usa la longitud y el alfabeto definidos', () => {
    let i = 0;
    const code = generateInviteCode((max) => i++ % max);
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const ch of code) expect(INVITE_CODE_ALPHABET).toContain(ch);
  });

  it('el alfabeto no tiene caracteres confundibles', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });
});

describe('normalizeInviteCode', () => {
  it('acepta minúsculas, guiones y espacios', () => {
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
  });

  it('extrae el código de un enlace pegado', () => {
    expect(
      normalizeInviteCode('https://tortiweb.app/join/abcd-efgh?utm=wa')
    ).toBe('ABCDEFGH');
  });

  it('formatInviteCode y normalizeInviteCode son inversas', () => {
    expect(normalizeInviteCode(formatInviteCode('ABCDEFGH'))).toBe('ABCDEFGH');
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });
});

describe('inviteStatus', () => {
  const now = new Date('2026-09-17T12:00:00Z');

  it('activa sin límites', () => {
    expect(inviteStatus({ uses: 5 }, now)).toBe('active');
  });

  it('revocada gana a cualquier otro estado', () => {
    expect(
      inviteStatus(
        { revokedAt: now, expiresAt: new Date(0), maxUses: 1, uses: 1 },
        now
      )
    ).toBe('revoked');
  });

  it('caducada justo en el instante de caducidad', () => {
    expect(inviteStatus({ expiresAt: now, uses: 0 }, now)).toBe('expired');
  });

  it('agotada al llegar al máximo de usos', () => {
    expect(inviteStatus({ maxUses: 2, uses: 1 }, now)).toBe('active');
    expect(inviteStatus({ maxUses: 2, uses: 2 }, now)).toBe('exhausted');
  });
});

describe('normalizeInviteLimits', () => {
  const now = new Date('2026-09-17T12:00:00Z');

  it('sin límites devuelve null en ambos', () => {
    expect(normalizeInviteLimits({}, now)).toEqual({
      expiresAt: null,
      maxUses: null,
    });
  });

  it('calcula la caducidad en días', () => {
    const { expiresAt } = normalizeInviteLimits({ expiresInDays: 7 }, now);
    expect(expiresAt?.toISOString()).toBe('2026-09-24T12:00:00.000Z');
  });

  it('rechaza valores fuera de rango o no enteros', () => {
    expect(() => normalizeInviteLimits({ expiresInDays: 0 }, now)).toThrow();
    expect(() =>
      normalizeInviteLimits({ expiresInDays: MAX_INVITE_DAYS + 1 }, now)
    ).toThrow();
    expect(() => normalizeInviteLimits({ maxUses: 1.5 }, now)).toThrow();
    expect(() =>
      normalizeInviteLimits({ maxUses: MAX_INVITE_USES + 1 }, now)
    ).toThrow();
  });
});
