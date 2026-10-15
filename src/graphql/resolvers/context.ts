import { Types } from 'mongoose';
import type { Session } from 'next-auth';

export type GqlContext = {
  session: Session | null;
};

/**
 * Identidad del usuario autenticado. El `id` es la referencia buena: el nombre
 * puede cambiar y la clave normalizada con él, pero el id no.
 */
export type CtxUser = {
  id: Types.ObjectId;
  key: string;
  name: string;
};

/** El usuario de la sesión, o `null` si no hay sesión o le falta username. */
export function sessionUser(session: Session | null): CtxUser | null {
  const user = session?.user;
  if (!user?.usernameKey || user.needsUsername) return null;
  if (!Types.ObjectId.isValid(user.id)) return null;
  return {
    id: new Types.ObjectId(user.id),
    key: user.usernameKey,
    name: user.username,
  };
}

export function requireUser(
  ctx: GqlContext,
  message = 'Debes iniciar sesión.'
): CtxUser {
  const user = sessionUser(ctx.session);
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
