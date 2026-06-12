/**
 * Formatea un número con un decimal usando coma como separador (locale ES/CA).
 * Ej: 7.5 → "7,5", 8.40 → "8,4".
 */
export function fmt(n: number): string {
  return Number(n).toFixed(1).replace('.', ',');
}
