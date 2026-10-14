/**
 * Lógica de logros. La definición se mantiene aquí (no en GraphQL) para que el
 * cómputo viva junto a las reglas y el frontend sólo necesite saber qué hay
 * desbloqueado.
 *
 * Los nombres y descripciones se localizan en el frontend a partir del `id`
 * (clave i18n `achievement.<id>.title|description`).
 */

export type AchievementId =
  | 'firstVote'
  | 'tenVotes'
  | 'fiftyVotes'
  | 'streak3'
  | 'streak5'
  | 'streak10'
  | 'perfectScore'
  | 'firstLowballer'
  | 'firstHighballer';

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
};

export type VoteForAchievements = {
  tortillaId: string;
  score: number;
};

type Input = {
  totalVotes: number;
  bestStreak: number;
  scores: number[];
  /** Para cada tortilla votada por el usuario, el min y max de TODOS los votos. */
  perTortillaMinMax: Map<string, { min: number; max: number }>;
  /** Notas que dio el usuario, indexadas por tortilla. */
  userVotesByTortilla: Map<string, number>;
};

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

type Def = {
  id: AchievementId;
  emoji: string;
  check: (i: Input) => boolean;
  /** Solo en los logros por umbral: qué se cuenta y cuánto hace falta. */
  counter?: { goal: number; value: (i: Input) => number };
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

const DEFS: Def[] = [
  threshold('firstVote', '🥇', 1, (i) => i.totalVotes),
  threshold('tenVotes', '🔟', 10, (i) => i.totalVotes),
  threshold('fiftyVotes', '💯', 50, (i) => i.totalVotes),
  threshold('streak3', '🔥', 3, (i) => i.bestStreak),
  threshold('streak5', '⚡', 5, (i) => i.bestStreak),
  threshold('streak10', '👑', 10, (i) => i.bestStreak),
  {
    id: 'perfectScore',
    emoji: '💎',
    check: (i) => i.scores.some((s) => s >= 10 - FLOAT_EPSILON),
  },
  { id: 'firstLowballer', emoji: '😠', check: isFirstLowballer },
  { id: 'firstHighballer', emoji: '⭐', check: isFirstHighballer },
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
  /** Todos los votos relevantes (de las tortillas en las que el usuario participó). */
  allRelevantVotes: { tortillaId: string; score: number }[];
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
  const input: Input = {
    totalVotes: args.totalVotes,
    bestStreak: args.bestStreak,
    scores,
    perTortillaMinMax,
    userVotesByTortilla,
  };
  return DEFS.map((d) => ({
    id: d.id,
    emoji: d.emoji,
    unlocked: d.check(input),
    progress: d.counter
      ? Math.min(d.counter.value(input), d.counter.goal)
      : null,
    goal: d.counter?.goal ?? null,
  }));
}
