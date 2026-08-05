/**
 * Búsqueda por palabras clave, insensible a mayúsculas y a acentos.
 *
 * Lo de los acentos no es un extra: en castellano y catalán la gente escribe
 * "calabacin" o "jamon" sin tilde y espera encontrar "Calabacín" y "Jamón".
 */

/** Rango Unicode de marcas diacríticas combinantes (tildes, diéresis, cedilla…). */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Pasa a minúsculas y quita los diacríticos (NFD separa la marca del carácter). */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .trim();
}

/**
 * Parte la consulta en palabras normalizadas. Una consulta vacía o solo con
 * espacios devuelve `[]`, que por convención significa "no filtrar".
 */
export function toSearchTokens(query: string): string[] {
  const normalized = normalizeForSearch(query);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * `true` si el texto contiene **todas** las palabras (AND), en cualquier orden
 * y como subcadena, de modo que "cebo" ya casa con "cebolla". Sin palabras,
 * siempre `true`: no hay filtro que aplicar.
 *
 * Normaliza también las palabras: en la app llegan ya normalizadas desde
 * `toSearchTokens`, pero así la función no depende de que quien la llame se
 * acuerde de hacerlo.
 */
export function matchesAllTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = normalizeForSearch(text);
  return tokens.every((token) => haystack.includes(normalizeForSearch(token)));
}
