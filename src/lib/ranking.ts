import { computeStreaks, type StreakTortilla } from './streak';
import { dayKey } from './dates';

/**
 * Ranking del grupo, calculado a partir de las tortillas y los votos. Sin
 * dependencias de base de datos: el resolver carga los datos y pone nombres
 * y fotos a las claves.
 */

/** Votos mínimos para entrar en el podio de tortillas: una sola nota no es una media. */
export const MIN_VOTES_PER_TORTILLA = 3;
/** Votos mínimos para entrar en "más duro" / "más generoso". */
export const MIN_VOTES_PER_VOTER = 5;
export const PODIUM_SIZE = 3;

export type RankingVote = {
  tortillaId: string;
  /** Identidad del votante: id de cuenta o, para votos históricos, el nombre. */
  voterKey: string;
  score: number;
};

export type RankedTortilla = {
  tortillaId: string;
  average: number;
  voteCount: number;
};

export type RankedVoter = {
  voterKey: string;
  /** Media dada, racha o nº de votos según la lista. */
  value: number;
  voteCount: number;
};

export type Ranking = {
  year: number;
  bestTortillas: RankedTortilla[];
  toughest: RankedVoter[];
  generous: RankedVoter[];
  streaks: RankedVoter[];
  mostVotes: RankedVoter[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Orden estable: por valor y, a igualdad, por más votos y luego por clave. */
function podium(
  list: RankedVoter[],
  direction: 'asc' | 'desc'
): RankedVoter[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...list]
    .sort(
      (a, b) =>
        sign * (a.value - b.value) ||
        b.voteCount - a.voteCount ||
        a.voterKey.localeCompare(b.voterKey)
    )
    .slice(0, PODIUM_SIZE);
}

export function computeRanking(args: {
  tortillas: StreakTortilla[];
  votes: RankingVote[];
  now?: Date;
}): Ranking {
  const now = args.now ?? new Date();
  const year = Number(dayKey(now).slice(0, 4));
  const yearOf = new Map(
    args.tortillas.map((t) => [t.id, Number(dayKey(t.date).slice(0, 4))])
  );

  // Tortillas del año en curso, por media.
  const byTortilla = new Map<string, number[]>();
  for (const v of args.votes) {
    if (yearOf.get(v.tortillaId) !== year) continue;
    const list = byTortilla.get(v.tortillaId) ?? [];
    list.push(v.score);
    byTortilla.set(v.tortillaId, list);
  }
  const bestTortillas = [...byTortilla.entries()]
    .filter(([, scores]) => scores.length >= MIN_VOTES_PER_TORTILLA)
    .map(([tortillaId, scores]) => ({
      tortillaId,
      average: round2(scores.reduce((s, x) => s + x, 0) / scores.length),
      voteCount: scores.length,
    }))
    .sort(
      (a, b) =>
        b.average - a.average ||
        b.voteCount - a.voteCount ||
        a.tortillaId.localeCompare(b.tortillaId)
    )
    .slice(0, PODIUM_SIZE);

  // Votantes: histórico completo.
  const byVoter = new Map<string, { scores: number[]; tortillas: Set<string> }>();
  for (const v of args.votes) {
    const entry = byVoter.get(v.voterKey) ?? { scores: [], tortillas: new Set() };
    entry.scores.push(v.score);
    entry.tortillas.add(v.tortillaId);
    byVoter.set(v.voterKey, entry);
  }

  const averages: RankedVoter[] = [];
  const streaks: RankedVoter[] = [];
  const counts: RankedVoter[] = [];
  for (const [voterKey, { scores, tortillas }] of byVoter) {
    const voteCount = scores.length;
    counts.push({ voterKey, value: voteCount, voteCount });
    if (voteCount >= MIN_VOTES_PER_VOTER) {
      averages.push({
        voterKey,
        value: round2(scores.reduce((s, x) => s + x, 0) / voteCount),
        voteCount,
      });
    }
    const { bestStreak } = computeStreaks({
      tortillas: args.tortillas,
      votedTortillaIds: tortillas,
      now,
    });
    if (bestStreak > 0) streaks.push({ voterKey, value: bestStreak, voteCount });
  }

  return {
    year,
    bestTortillas,
    toughest: podium(averages, 'asc'),
    generous: podium(averages, 'desc'),
    streaks: podium(streaks, 'desc'),
    mostVotes: podium(counts, 'desc'),
  };
}
