/**
 * Longitud máxima de un comentario, igual que Twitter/X. Se mide sobre el texto
 * ya normalizado con `String.length`, así que cada carácter cuenta.
 */
export const MAX_COMMENT_LENGTH = 280;

/**
 * Normaliza el texto de un comentario para evitar que se rompa la maquetación:
 * unifica los saltos de línea y **colapsa los saltos de línea consecutivos** en
 * uno solo (con `white-space: pre-wrap` cada `\n` se renderiza, así que decenas
 * de saltos seguidos creaban un bloque vertical enorme). También recorta los
 * espacios al final de cada línea y los extremos del texto.
 */
export function normalizeCommentText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n') // CRLF / CR -> LF
    .replace(/[ \t]+\n/g, '\n') // espacios/tabs al final de línea
    .replace(/\n{2,}/g, '\n') // colapsa saltos de línea consecutivos
    .trim();
}
