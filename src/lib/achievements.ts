/**
 * Lógica de logros. La definición se mantiene aquí (no en GraphQL) para que el
 * cómputo viva junto a las reglas y el frontend sólo necesite saber qué hay
 * desbloqueado.
 *
 * Los nombres y descripciones se localizan en el frontend a partir del `id`
 * (clave i18n `achievement.<id>.title|description`).
 */

import { dayKey, daysUntil, hourIn } from './dates';
import { MAX_COMMENT_LENGTH } from './comments';

export type AchievementId =
  | 'firstVote'
  | 'tenVotes'
  | 'fiftyVotes'
  | 'hundredVotes'
  | 'streak3'
  | 'streak5'
  | 'streak10'
  | 'streak20'
  | 'perfectScore'
  | 'noMercy'
  | 'firstLowballer'
  | 'firstHighballer'
  | 'oracle'
  | 'earlyBird'
  | 'doubleDay'
  | 'anniversary'
  | 'eventRegular'
  | 'commenter'
  | 'expressive'
  | 'icebreaker'
  // Ocultos: no aparecen hasta que se desbloquean.
  | 'canut'
  | 'nightOwl'
  | 'pi'
  | 'onionLover'
  | 'novelist';

export type Achievement = {
  id: AchievementId;
  emoji: string;
  unlocked: boolean;
  /**
   * Avance hacia el logro, solo en los que se cuentan (votos, rachas). Los de
   * sí/no (nota perfecta, el más duro…) no tienen. `progress` nunca pasa de
   * `goal`.
   */
  progress: number | null;
  goal: number | null;
  /** Oculto: invisible hasta desbloquearlo (ver `visibleAchievements`). */
  hidden: boolean;
};

export type VoteForAchievements = {
  tortillaId: string;
  score: number;
  reaction?: string | null;
  /**
   * Fecha de la tortilla, no la del voto: los votos importados del Excel
   * comparten fecha de alta y falsearían "Doblete" y "Aniversario".
   */
  tortillaDate: Date;
  /** Cuándo se votó: alta y, si se cambió, última modificación. */
  castAt: Date[];
};

/** Un voto de cualquiera en una tortilla que el usuario también votó. */
export type RelevantVote = {
  tortillaId: string;
  score: number;
  createdAt: Date;
  /** Si es el voto del propio usuario. */
  mine: boolean;
};

/** Un comentario en una tortilla que el usuario también comentó. */
export type RelevantComment = {
  tortillaId: string;
  createdAt: Date;
  mine: boolean;
};

/** "Oráculo": a cuánto de la media final cuenta como acertar. */
export const ORACLE_TOLERANCE = 0.2;
/** "Oráculo": con menos votos la media es casi tu propia nota. */
export const ORACLE_MIN_VOTES = 3;
/** "Sin piedad": nota máxima que cuenta. */
export const NO_MERCY_MAX_SCORE = 2;
/** "Noctámbulo": votar desde las 00:00 hasta antes de esta hora (Madrid). */
export const NIGHT_OWL_UNTIL_HOUR = 5;
/** "Pi": la nota exacta. */
export const PI_SCORE = 3.1;
/** Las cuatro reacciones rápidas (ver `REACTIONS` en el modelo de voto). */
const REACTION_COUNT = 4;

type Input = {
  totalVotes: number;
  bestStreak: number;
  scores: number[];
  /** Para cada tortilla votada por el usuario, el min y max de TODOS los votos. */
  perTortillaMinMax: Map<string, { min: number; max: number }>;
  /** Notas que dio el usuario, indexadas por tortilla. */
  userVotesByTortilla: Map<string, number>;
  oracleHits: number;
  firstVotes: number;
  hasDoubleDay: boolean;
  /** Días entre la primera y la última tortilla votada. */
  votingSpanDays: number;
  attendedEvents: number;
  commentCount: number;
  firstComments: number;
  reactionsUsed: number;
  myCommentTexts: string[];
  castTimes: Date[];
};

/**
 * Si el texto contiene alguna de las palabras sueltas, sin distinguir
 * mayúsculas: "Canut!" sí, "canuto" o "escanut" no. Los límites de palabra
 * cuentan letras con tilde (`\b` de JS solo entiende ASCII).
 */
export function containsWord(text: string, words: string[]): boolean {
  return words.some((word) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'iu').test(text)
  );
}

const FLOAT_EPSILON = 1e-9;

function isFirstLowballer(input: Input): boolean {
  for (const [tortillaId, score] of input.userVotesByTortilla) {
    const stat = input.perTortillaMinMax.get(tortillaId);
    if (!stat) continue;
    if (Math.abs(score - stat.min) < FLOAT_EPSILON) return true;
  }
  return false;
}

function isFirstHighballer(input: Input): boolean {
  for (const [tortillaId, score] of input.userVotesByTortilla) {
    const stat = input.perTortillaMinMax.get(tortillaId);
    if (!stat) continue;
    if (Math.abs(score - stat.max) < FLOAT_EPSILON) return true;
  }
  return false;
}

/**
 * En cuántas tortillas lo primero (voto o comentario) fue del usuario. Solo
 * si fue estrictamente el primero: con empate en la hora no cuenta para
 * nadie, para que los datos importados en bloque no lo regalen.
 */
function countFirsts(
  items: { tortillaId: string; createdAt: Date; mine: boolean }[]
): number {
  const earliest = new Map<string, { time: number; mine: boolean; tied: boolean }>();
  for (const item of items) {
    const time = item.createdAt.getTime();
    const current = earliest.get(item.tortillaId);
    if (!current || time < current.time) {
      earliest.set(item.tortillaId, { time, mine: item.mine, tied: false });
    } else if (time === current.time) {
      current.tied = true;
    }
  }
  let count = 0;
  for (const e of earliest.values()) if (e.mine && !e.tied) count += 1;
  return count;
}

/** Tortillas cerradas en las que la nota del usuario clavó la media final. */
function countOracleHits(
  userVotesByTortilla: Map<string, number>,
  allRelevantVotes: RelevantVote[],
  finished: Set<string>
): number {
  const byTortilla = new Map<string, number[]>();
  for (const v of allRelevantVotes) {
    if (!finished.has(v.tortillaId)) continue;
    const list = byTortilla.get(v.tortillaId) ?? [];
    list.push(v.score);
    byTortilla.set(v.tortillaId, list);
  }
  let hits = 0;
  for (const [tortillaId, scores] of byTortilla) {
    const mine = userVotesByTortilla.get(tortillaId);
    if (mine === undefined || scores.length < ORACLE_MIN_VOTES) continue;
    const average = scores.reduce((s, x) => s + x, 0) / scores.length;
    if (Math.abs(mine - average) <= ORACLE_TOLERANCE + FLOAT_EPSILON) hits += 1;
  }
  return hits;
}

type Def = {
  id: AchievementId;
  emoji: string;
  check: (i: Input) => boolean;
  /** Solo en los logros por umbral: qué se cuenta y cuánto hace falta. */
  counter?: { goal: number; value: (i: Input) => number };
  hidden?: boolean;
};

/** Logro por umbral: se desbloquea al llegar a `goal` y enseña el avance. */
function threshold(
  id: AchievementId,
  emoji: string,
  goal: number,
  value: (i: Input) => number
): Def {
  return { id, emoji, check: (i) => value(i) >= goal, counter: { goal, value } };
}

/** En el orden en que se muestran en el perfil. */
const DEFS: Def[] = [
  threshold('firstVote', '🥇', 1, (i) => i.totalVotes),
  threshold('tenVotes', '🔟', 10, (i) => i.totalVotes),
  threshold('fiftyVotes', '💯', 50, (i) => i.totalVotes),
  threshold('hundredVotes', '🏛️', 100, (i) => i.totalVotes),
  threshold('streak3', '🔥', 3, (i) => i.bestStreak),
  threshold('streak5', '⚡', 5, (i) => i.bestStreak),
  threshold('streak10', '👑', 10, (i) => i.bestStreak),
  threshold('streak20', '🐉', 20, (i) => i.bestStreak),
  {
    id: 'perfectScore',
    emoji: '💎',
    check: (i) => i.scores.some((s) => s >= 10 - FLOAT_EPSILON),
  },
  {
    id: 'noMercy',
    emoji: '🧊',
    check: (i) => i.scores.some((s) => s <= NO_MERCY_MAX_SCORE + FLOAT_EPSILON),
  },
  { id: 'firstLowballer', emoji: '😠', check: isFirstLowballer },
  { id: 'firstHighballer', emoji: '⭐', check: isFirstHighballer },
  threshold('oracle', '🎯', 3, (i) => i.oracleHits),
  threshold('earlyBird', '🌅', 3, (i) => i.firstVotes),
  { id: 'doubleDay', emoji: '🍳', check: (i) => i.hasDoubleDay },
  { id: 'anniversary', emoji: '🎂', check: (i) => i.votingSpanDays >= 365 },
  threshold('eventRegular', '📅', 5, (i) => i.attendedEvents),
  threshold('commenter', '💬', 10, (i) => i.commentCount),
  threshold('expressive', '🎭', REACTION_COUNT, (i) => i.reactionsUsed),
  { id: 'icebreaker', emoji: '🗨️', check: (i) => i.firstComments > 0 },

  // --- Ocultos ---
  {
    id: 'canut',
    emoji: '🌿',
    hidden: true,
    check: (i) => i.myCommentTexts.some((t) => containsWord(t, ['canut'])),
  },
  {
    id: 'nightOwl',
    emoji: '🦉',
    hidden: true,
    check: (i) => i.castTimes.some((d) => hourIn(d) < NIGHT_OWL_UNTIL_HOUR),
  },
  {
    id: 'pi',
    emoji: '🥧',
    hidden: true,
    check: (i) => i.scores.some((s) => Math.abs(s - PI_SCORE) < FLOAT_EPSILON),
  },
  {
    id: 'onionLover',
    emoji: '🧅',
    hidden: true,
    // Castellano y catalán.
    check: (i) =>
      i.myCommentTexts.some((t) => containsWord(t, ['cebolla', 'ceba'])),
  },
  {
    id: 'novelist',
    emoji: '📜',
    hidden: true,
    check: (i) => i.myCommentTexts.some((t) => t.length >= MAX_COMMENT_LENGTH),
  },
];

/** Ids válidos, en el orden en que se muestran. */
export const ACHIEVEMENT_IDS: readonly AchievementId[] = DEFS.map((d) => d.id);

export function isAchievementId(id: string): id is AchievementId {
  return (ACHIEVEMENT_IDS as readonly string[]).includes(id);
}

/**
 * Logros desbloqueados que el usuario aún no ha visto celebrar. Un logro que
 * se pierde y se recupera (p. ej. "El más duro" cuando alguien pone una nota
 * más baja) no se vuelve a celebrar: sigue en `seen`.
 */
export function unseenAchievements(
  achievements: Achievement[],
  seen: readonly string[]
): Achievement[] {
  const seenSet = new Set(seen);
  return achievements.filter((a) => a.unlocked && !seenSet.has(a.id));
}

export function computeAchievements(args: {
  totalVotes: number;
  bestStreak: number;
  userVotes: VoteForAchievements[];
  /** Todos los votos de las tortillas en las que el usuario participó. */
  allRelevantVotes: RelevantVote[];
  /** Tortillas con la votación ya terminada (su media es la final). */
  finishedTortillaIds: Iterable<string>;
  /** Todos los comentarios de las tortillas que el usuario comentó. */
  relevantComments: RelevantComment[];
  /** Texto de los comentarios del propio usuario (para los ocultos). */
  myCommentTexts: string[];
  /** Convocatorias a las que se apuntó. */
  attendedEvents: number;
}): Achievement[] {
  const scores = args.userVotes.map((v) => v.score);
  const userVotesByTortilla = new Map<string, number>(
    args.userVotes.map((v) => [v.tortillaId, v.score])
  );
  const perTortillaMinMax = new Map<string, { min: number; max: number }>();
  for (const v of args.allRelevantVotes) {
    const current = perTortillaMinMax.get(v.tortillaId);
    if (!current) {
      perTortillaMinMax.set(v.tortillaId, { min: v.score, max: v.score });
    } else {
      if (v.score < current.min) current.min = v.score;
      if (v.score > current.max) current.max = v.score;
    }
  }

  const votesPerDay = new Map<string, number>();
  for (const v of args.userVotes) {
    const day = dayKey(v.tortillaDate);
    votesPerDay.set(day, (votesPerDay.get(day) ?? 0) + 1);
  }
  const times = args.userVotes.map((v) => v.tortillaDate.getTime());
  const votingSpanDays = times.length
    ? daysUntil(new Date(Math.max(...times)), new Date(Math.min(...times)))
    : 0;

  const input: Input = {
    totalVotes: args.totalVotes,
    bestStreak: args.bestStreak,
    scores,
    perTortillaMinMax,
    userVotesByTortilla,
    oracleHits: countOracleHits(
      userVotesByTortilla,
      args.allRelevantVotes,
      new Set(args.finishedTortillaIds)
    ),
    firstVotes: countFirsts(args.allRelevantVotes),
    hasDoubleDay: [...votesPerDay.values()].some((n) => n >= 2),
    votingSpanDays,
    attendedEvents: args.attendedEvents,
    commentCount: args.relevantComments.filter((c) => c.mine).length,
    firstComments: countFirsts(args.relevantComments),
    reactionsUsed: new Set(
      args.userVotes.map((v) => v.reaction).filter((r): r is string => Boolean(r))
    ).size,
    myCommentTexts: args.myCommentTexts,
    castTimes: args.userVotes.flatMap((v) => v.castAt),
  };
  return DEFS.map((d) => ({
    id: d.id,
    emoji: d.emoji,
    unlocked: d.check(input),
    progress: d.counter
      ? Math.min(d.counter.value(input), d.counter.goal)
      : null,
    goal: d.counter?.goal ?? null,
    hidden: Boolean(d.hidden),
  }));
}

/** Lo que se enseña en el perfil: los ocultos solo una vez desbloqueados. */
export function visibleAchievements(list: Achievement[]): Achievement[] {
  return list.filter((a) => !a.hidden || a.unlocked);
}
