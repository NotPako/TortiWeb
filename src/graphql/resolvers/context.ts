import type { Session } from 'next-auth';

export type GqlContext = {
  session: Session | null;
};

/** Usuario con sesión completa (ya eligió username). */
export type SessionUser = {
  id: string;
  userKey: string;
  userName: string;
};

/** El usuario de la sesión, o `null` si no hay sesión o le falta username. */
export function sessionUser(ctx: GqlContext): SessionUser | null {
  const user = ctx.session?.user;
  if (!user?.usernameKey || user.needsUsername) return null;
  return { id: user.id, userKey: user.usernameKey, userName: user.username };
}

export function requireUser(
  ctx: GqlContext,
  message = 'Debes iniciar sesión.'
): SessionUser {
  const user = sessionUser(ctx);
  if (!user) throw new Error(message);
  return user;
}

/** Error de índice único de MongoDB (E11000). */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 11000
  );
}
