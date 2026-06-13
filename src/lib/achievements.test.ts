import { describe, it, expect } from 'vitest';
import { computeAchievements, type AchievementId } from './achievements';

/** Helper: mapa id -> unlocked para asertar cómodamente. */
function unlockedMap(args: Parameters<typeof computeAchievements>[0]) {
  const result = computeAchievements(args);
  return new Map<AchievementId, boolean>(
    result.map((a) => [a.id, a.unlocked])
  );
}

const empty = {
  totalVotes: 0,
  bestStreak: 0,
  userVotes: [],
  allRelevantVotes: [],
};

describe('computeAchievements', () => {
  it('devuelve los 10 logros, todos bloqueados sin actividad', () => {
    const result = computeAchievements(empty);
    expect(result).toHaveLength(10);
    expect(result.every((a) => !a.unlocked)).toBe(true);
  });

  it('desbloquea hitos de votos por umbral', () => {
    const m = unlockedMap({ ...empty, totalVotes: 10 });
    expect(m.get('firstVote')).toBe(true);
    expect(m.get('tenVotes')).toBe(true);
    expect(m.get('fiftyVotes')).toBe(false);
  });

  it('desbloquea rachas hasta el umbral alcanzado', () => {
    const m = unlockedMap({ ...empty, bestStreak: 5 });
    expect(m.get('streak3')).toBe(true);
    expect(m.get('streak5')).toBe(true);
    expect(m.get('streak10')).toBe(false);
  });

  it('detecta nota perfecta y nota cero', () => {
    const perfect = unlockedMap({
      ...empty,
      totalVotes: 1,
      userVotes: [{ tortillaId: 't1', score: 10 }],
      allRelevantVotes: [{ tortillaId: 't1', score: 10 }],
    });
    expect(perfect.get('perfectScore')).toBe(true);
    expect(perfect.get('zeroScore')).toBe(false);

    const zero = unlockedMap({
      ...empty,
      totalVotes: 1,
      userVotes: [{ tortillaId: 't1', score: 0 }],
      allRelevantVotes: [{ tortillaId: 't1', score: 0 }],
    });
    expect(zero.get('zeroScore')).toBe(true);
  });

  it('marca lowballer/highballer según el min/max de la tortilla', () => {
    // El usuario puso 4 (el más bajo) y otro votante puso 9 (el más alto).
    const m = unlockedMap({
      ...empty,
      totalVotes: 1,
      userVotes: [{ tortillaId: 't1', score: 4 }],
      allRelevantVotes: [
        { tortillaId: 't1', score: 4 },
        { tortillaId: 't1', score: 9 },
      ],
    });
    expect(m.get('firstLowballer')).toBe(true);
    expect(m.get('firstHighballer')).toBe(false);
  });
});
