/**
 * Cumpleaños: solo día y mes. Para el gorro de fiesta no hace falta el año, y
 * así no se guarda la edad de nadie.
 *
 * Sin dependencias de servidor: lo usan los resolvers y los formularios.
 */

export type Birthday = { day: number; month: number };

/** Zona horaria del grupo: "hoy" es hoy en Madrid, no en UTC. */
export const BIRTHDAY_TIME_ZONE = 'Europe/Madrid';

/** Días máximos por mes (1-12). Febrero admite el 29. */
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function maxDayOfMonth(month: number): number {
  return MAX_DAY[month - 1] ?? 31;
}

/** Valida y normaliza. Lanza con un mensaje para el usuario si no es válido. */
export function validateBirthday(input: {
  day: number;
  month: number;
}): Birthday {
  const { day, month } = input;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('El mes del cumpleaños no es válido.');
  }
  if (!Number.isInteger(day) || day < 1 || day > maxDayOfMonth(month)) {
    throw new Error('El día del cumpleaños no es válido.');
  }
  return { day, month };
}

export type CalendarDay = { year: number; month: number; day: number };

/** Fecha de calendario de `now` en la zona del grupo. */
export function todayInTimeZone(
  now: Date = new Date(),
  timeZone: string = BIRTHDAY_TIME_ZONE
): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Cumpleaños que se celebran en `today`. Normalmente uno; el 28 de febrero de
 * un año no bisiesto también cuenta para quien nació el 29.
 */
export function birthdaysCelebratedOn(today: CalendarDay): Birthday[] {
  const list: Birthday[] = [{ day: today.day, month: today.month }];
  if (today.month === 2 && today.day === 28 && !isLeapYear(today.year)) {
    list.push({ day: 29, month: 2 });
  }
  return list;
}

/** Lo que hay en el formulario mientras se elige: puede faltar uno de los dos. */
export type BirthdayDraft = { day: number | null; month: number | null };

/** Solo uno de los dos elegido: el formulario no debe enviarse así. */
export function isIncompleteBirthday(
  draft: BirthdayDraft | null | undefined
): boolean {
  if (!draft) return false;
  return (draft.day == null) !== (draft.month == null);
}

/** Cumpleaños a guardar, o null si no se eligió (o está a medias). */
export function birthdayFromDraft(
  draft: BirthdayDraft | null | undefined
): Birthday | null {
  if (!draft || draft.day == null || draft.month == null) return null;
  return { day: draft.day, month: draft.month };
}

/** "14 de octubre" / "14 d’octubre", según el idioma. */
export function formatBirthday(birthday: Birthday, locale: string): string {
  // Año bisiesto fijo para que el 29 de febrero exista; UTC para que la zona
  // del navegador no mueva el día.
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(Date.UTC(2000, birthday.month - 1, birthday.day));
}
