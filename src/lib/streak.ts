import { dayKey } from './dates';

/**
 * Rachas de participación, contadas **por día** y no por tortilla.
 *
 * Un día de tortilla puede tener más de una (a veces se cocinan dos distintas),
 * y participar es haber votado *alguna* de ellas: obligar a votarlas todas
 * castigaría a quien solo probó una, que es justo lo contrario de lo que la
 * racha quiere premiar.
 */

export type StreakTortilla = {
  id: string;
  date: Date;
};

export type Streaks = {
  currentStreak: number;
  bestStreak: number;
};

/**
 * Agrupa las tortillas por día natural (zona horaria de la app) y devuelve los
 * días ordenados del más reciente al más antiguo.
 */
function groupByDayDesc(
  tortillas: StreakTortilla[]
): Array<{ day: string; tortillaIds: string[] }> {
  const byDay = new Map<string, string[]>();
  for (const tortilla of tortillas) {
    const day = dayKey(tortilla.date);
    const ids = byDay.get(day);
    if (ids) {
      ids.push(tortilla.id);
    } else {
      byDay.set(day, [tortilla.id]);
    }
  }
  return [...byDay.entries()]
    .map(([day, tortillaIds]) => ({ day, tortillaIds }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

export function computeStreaks(args: {
  tortillas: StreakTortilla[];
  votedTortillaIds: Iterable<string>;
  now?: Date;
}): Streaks {
  const voted = new Set(args.votedTortillaIds);
  const now = args.now ?? new Date();
  const days = groupByDayDesc(args.tortillas);

  const participated = days.map((d) =>
    d.tortillaIds.some((id) => voted.has(id))
  );

  // El día de hoy aún está en juego: si todavía no has votado no cuenta como
  // hueco, para no romper la racha a media mañana.
  let startIndex = 0;
  if (days.length > 0 && days[0].day === dayKey(now) && !participated[0]) {
    startIndex = 1;
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let runLength = 0;
  let foundFirstGap = false;
  for (let i = startIndex; i < days.length; i++) {
    if (participated[i]) {
      runLength++;
      if (runLength > bestStreak) bestStreak = runLength;
    } else {
      if (!foundFirstGap) {
        currentStreak = runLength;
        foundFirstGap = true;
      }
      runLength = 0;
    }
  }
  if (!foundFirstGap) currentStreak = runLength;

  return { currentStreak, bestStreak };
}
