/** Zona horaria de referencia de la aplicación (las tortillas son de Madrid). */
export const APP_TIMEZONE = 'Europe/Madrid';

/** Clave de día (YYYY-MM-DD) en una zona horaria, para comparar días. */
export function dayKey(d: Date, tz: string = APP_TIMEZONE): string {
  return d.toLocaleDateString('en-CA', { timeZone: tz });
}

/** True si dos fechas caen el mismo día natural en la zona indicada. */
export function isSameDay(a: Date, b: Date, tz: string = APP_TIMEZONE): boolean {
  return dayKey(a, tz) === dayKey(b, tz);
}

/**
 * Próximo miércoles (hoy si ya es miércoles). Fijado a mediodía para evitar
 * saltos de día por zona horaria. El admin puede editar la fecha igualmente.
 */
export function nextWednesday(from: Date = new Date()): Date {
  const d = new Date(from);
  const diff = (3 - d.getDay() + 7) % 7; // 0=domingo .. 3=miércoles
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Días naturales (en la zona de la app) que faltan hasta `target`: 0 si es
 * hoy, 1 si es mañana. Negativo si ya pasó.
 */
export function daysUntil(
  target: Date,
  from: Date = new Date(),
  tz: string = APP_TIMEZONE
): number {
  // Medianoche UTC de cada día natural: la resta da días enteros sin que el
  // cambio de hora (23 o 25 h) descuadre el resultado.
  const toUtcDay = (d: Date) => Date.parse(`${dayKey(d, tz)}T00:00:00Z`);
  return Math.round((toUtcDay(target) - toUtcDay(from)) / 86_400_000);
}
