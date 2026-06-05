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
  | 'zeroScore'
  | 'firstLowballer'
  | 'firstHighballer';

export type Achievement = {
  id: AchievementId;
  emoji: string;
  unlocked: boolean;
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

const DEFS: Array<{
  id: AchievementId;
  emoji: string;
  check: (i: Input) => boolean;
}> = [
  { id: 'firstVote', emoji: '🥇', check: (i) => i.totalVotes >= 1 },
  { id: 'tenVotes', emoji: '🔟', check: (i) => i.totalVotes >= 10 },
  { id: 'fiftyVotes', emoji: '💯', check: (i) => i.totalVotes >= 50 },
  { id: 'streak3', emoji: '🔥', check: (i) => i.bestStreak >= 3 },
  { id: 'streak5', emoji: '⚡', check: (i) => i.bestStreak >= 5 },
  { id: 'streak10', emoji: '👑', check: (i) => i.bestStreak >= 10 },
  {
    id: 'perfectScore',
    emoji: '💎',
    check: (i) => i.scores.some((s) => s >= 10 - FLOAT_EPSILON),
  },
  {
    id: 'zeroScore',
    emoji: '💩',
    check: (i) => i.scores.some((s) => s <= FLOAT_EPSILON),
  },
  { id: 'firstLowballer', emoji: '😠', check: isFirstLowballer },
  { id: 'firstHighballer', emoji: '⭐', check: isFirstHighballer },
];

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
  }));
}
