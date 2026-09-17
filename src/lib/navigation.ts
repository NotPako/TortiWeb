/** Destino por defecto tras iniciar sesión: la lista de grupos. */
export const DEFAULT_AFTER_LOGIN = '/groups';

/**
 * Devuelve `value` solo si es una ruta interna (`/algo`). Evita que un
 * `?callbackUrl=https://malo.example` o `//malo.example` saque al usuario de la
 * app tras iniciar sesión.
 */
export function safeCallbackUrl(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN
): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

/** Añade `?callbackUrl=` a una ruta, si hay un destino distinto del defecto. */
export function withCallbackUrl(path: string, callbackUrl: string): string {
  if (callbackUrl === DEFAULT_AFTER_LOGIN) return path;
  return `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
