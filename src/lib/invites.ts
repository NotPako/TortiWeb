/**
 * Invitaciones a un grupo: generación y lectura de códigos, y estado.
 *
 * Lógica pura. El generador recibe la fuente de aleatoriedad para que este
 * módulo no dependa de `crypto` de Node y se pueda importar desde el cliente.
 */

/**
 * Sin 0/O ni 1/I/L: el código se dicta por teléfono o se copia de un WhatsApp,
 * y esos pares se confunden.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

export const MAX_INVITE_DAYS = 90;
export const MAX_INVITE_USES = 100;

export const INVITE_STATUSES = [
  'active',
  'revoked',
  'expired',
  'exhausted',
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

/**
 * Genera un código aleatorio. `randomInt(max)` debe devolver un entero
 * uniforme en `[0, max)` criptográficamente seguro (en servidor,
 * `crypto.randomInt`). 31^8 ≈ 8,5·10^11 combinaciones.
 */
export function generateInviteCode(randomInt: (max: number) => number): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Normaliza lo que pega el usuario: acepta el código con guion, en minúsculas
 * o el enlace completo (`https://…/join/abcd-efgh`).
 */
export function normalizeInviteCode(input: string): string {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/join\/([^/?#\s]+)/);
  const raw = fromLink ? decodeURIComponent(fromLink[1]) : trimmed;
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "ABCDEFGH" → "ABCD-EFGH", más fácil de leer y dictar. */
export function formatInviteCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return code.length > 4 ? `${code.slice(0, half)}-${code.slice(half)}` : code;
}

export type InviteState = {
  revokedAt?: Date | null;
  expiresAt?: Date | null;
  maxUses?: number | null;
  uses: number;
};

/** Estado de una invitación en un instante dado. La revocación manda. */
export function inviteStatus(invite: InviteState, now: Date): InviteStatus {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }
  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    return 'exhausted';
  }
  return 'active';
}

/** Valida los límites opcionales al crear una invitación. */
export function normalizeInviteLimits(
  input: { expiresInDays?: number | null; maxUses?: number | null },
  now: Date
): { expiresAt: Date | null; maxUses: number | null } {
  const { expiresInDays, maxUses } = input;
  if (expiresInDays != null) {
    if (
      !Number.isInteger(expiresInDays) ||
      expiresInDays < 1 ||
      expiresInDays > MAX_INVITE_DAYS
    ) {
      throw new Error(
        `La caducidad debe estar entre 1 y ${MAX_INVITE_DAYS} días.`
      );
    }
  }
  if (maxUses != null) {
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_INVITE_USES) {
      throw new Error(
        `El número de usos debe estar entre 1 y ${MAX_INVITE_USES}.`
      );
    }
  }
  return {
    expiresAt:
      expiresInDays != null
        ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    maxUses: maxUses ?? null,
  };
}
