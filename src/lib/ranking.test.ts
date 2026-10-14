import { describe, it, expect } from 'vitest';
import { computeRanking, type RankingVote } from './ranking';

const now = new Date('2026-10-14T12:00:00Z');
// Miércoles consecutivos de 2026 y uno de 2025.
const tortillas = [
  { id: 't1', date: new Date('2026-09-23T12:00:00Z') },
  { id: 't2', date: new Date('2026-09-30T12:00:00Z') },
  { id: 't3', date: new Date('2026-10-07T12:00:00Z') },
  { id: 't4', date: new Date('2026-10-14T12:00:00Z') },
  { id: 'old', date: new Date('2025-12-17T12:00:00Z') },
];

function votes(voterKey: string, scores: Record<string, number>): RankingVote[] {
  return Object.entries(scores).map(([tortillaId, score]) => ({
    tortillaId,
    voterKey,
    score,
  }));
}

describe('computeRanking', () => {
  const all = [
    ...votes('ana', { t1: 9, t2: 8, t3: 9, t4: 10, old: 9 }),
    ...votes('luis', { t1: 3, t2: 4, t3: 2, t4: 5, old: 4 }),
    ...votes('pepe', { t1: 7, t3: 6, t4: 7, old: 10 }),
    ...votes('marta', { old: 10, t4: 6 }),
  ];
  const ranking = computeRanking({ tortillas, votes: all, now });

  it('el podio de tortillas es solo del año y exige votos mínimos', () => {
    expect(ranking.year).toBe(2026);
    expect(ranking.bestTortillas.map((t) => t.tortillaId)).toEqual([
      't4',
      't1',
      't3',
    ]);
    // `old` tiene la mejor media pero es de 2025.
    expect(ranking.bestTortillas.some((t) => t.tortillaId === 'old')).toBe(false);
    // t2 solo tiene 2 votos.
    expect(ranking.bestTortillas.some((t) => t.tortillaId === 't2')).toBe(false);
    expect(ranking.bestTortillas[0]).toMatchObject({ average: 7, voteCount: 4 });
  });

  it('duro y generoso solo cuentan a quien tiene votos suficientes', () => {
    expect(ranking.toughest.map((v) => v.voterKey)).toEqual(['luis', 'ana']);
    expect(ranking.generous.map((v) => v.voterKey)).toEqual(['ana', 'luis']);
    expect(ranking.toughest[0].value).toBe(3.6);
  });

  it('la racha se cuenta por días consecutivos', () => {
    expect(ranking.streaks[0]).toMatchObject({ voterKey: 'ana', value: 5 });
    // Pepe se saltó t2: su mejor racha son t3+t4.
    const pepe = ranking.streaks.find((v) => v.voterKey === 'pepe');
    expect(pepe?.value ?? 0).toBeLessThan(5);
  });

  it('más votos ordena por número de votos', () => {
    expect(ranking.mostVotes.map((v) => [v.voterKey, v.value])).toEqual([
      ['ana', 5],
      ['luis', 5],
      ['pepe', 4],
    ]);
  });

  it('sin datos, listas vacías', () => {
    const empty = computeRanking({ tortillas: [], votes: [], now });
    expect(empty.bestTortillas).toEqual([]);
    expect(empty.toughest).toEqual([]);
    expect(empty.mostVotes).toEqual([]);
  });
});
