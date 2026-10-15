import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_IDS,
  computeAchievements,
  unseenAchievements,
  type AchievementId,
  type RelevantVote,
  type VoteForAchievements,
} from './achievements';
import { dictionaries, SUPPORTED_LANGUAGES, type TranslationKey } from './i18n';

type Args = Parameters<typeof computeAchievements>[0];

const empty: Args = {
  totalVotes: 0,
  bestStreak: 0,
  userVotes: [],
  allRelevantVotes: [],
  finishedTortillaIds: [],
  relevantComments: [],
  attendedEvents: 0,
};

/** Helper: mapa id -> unlocked para asertar cómodamente. */
function unlockedMap(args: Args) {
  return new Map<AchievementId, boolean>(
    computeAchievements(args).map((a) => [a.id, a.unlocked])
  );
}

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const at = (min: number) => new Date(Date.UTC(2026, 9, 14, 10, min));

function myVote(
  tortillaId: string,
  score: number,
  extra: Partial<VoteForAchievements> = {}
): VoteForAchievements {
  return { tortillaId, score, tortillaDate: day('2026-10-14'), ...extra };
}

function relVote(
  tortillaId: string,
  score: number,
  mine = false,
  createdAt = at(0)
): RelevantVote {
  return { tortillaId, score, mine, createdAt };
}

/** Un único voto del usuario, que es también el único de la tortilla. */
function soloVote(score: number): Args {
  return {
    ...empty,
    totalVotes: 1,
    userVotes: [myVote('t1', score)],
    allRelevantVotes: [relVote('t1', score, true)],
  };
}

describe('computeAchievements', () => {
  it('devuelve los 20 logros, todos bloqueados sin actividad', () => {
    const result = computeAchievements(empty);
    expect(result).toHaveLength(20);
    expect(result.every((a) => !a.unlocked)).toBe(true);
  });

  it('desbloquea hitos de votos por umbral', () => {
    const m = unlockedMap({ ...empty, totalVotes: 100 });
    expect(m.get('firstVote')).toBe(true);
    expect(m.get('fiftyVotes')).toBe(true);
    expect(m.get('hundredVotes')).toBe(true);
    expect(unlockedMap({ ...empty, totalVotes: 99 }).get('hundredVotes')).toBe(false);
  });

  it('desbloquea rachas hasta el umbral alcanzado', () => {
    const m = unlockedMap({ ...empty, bestStreak: 10 });
    expect(m.get('streak10')).toBe(true);
    expect(m.get('streak20')).toBe(false);
    expect(unlockedMap({ ...empty, bestStreak: 20 }).get('streak20')).toBe(true);
  });

  it('detecta nota perfecta y "sin piedad"', () => {
    expect(unlockedMap(soloVote(10)).get('perfectScore')).toBe(true);
    expect(unlockedMap(soloVote(9.9)).get('perfectScore')).toBe(false);
    expect(unlockedMap(soloVote(2)).get('noMercy')).toBe(true);
    expect(unlockedMap(soloVote(2.1)).get('noMercy')).toBe(false);
  });

  it('marca lowballer/highballer según el min/max de la tortilla', () => {
    // El usuario puso 4 (el más bajo) y otro votante puso 9 (el más alto).
    const m = unlockedMap({
      ...empty,
      totalVotes: 1,
      userVotes: [myVote('t1', 4)],
      allRelevantVotes: [relVote('t1', 4, true), relVote('t1', 9)],
    });
    expect(m.get('firstLowballer')).toBe(true);
    expect(m.get('firstHighballer')).toBe(false);
  });
});

describe('Oráculo', () => {
  /** Tres tortillas donde el usuario puso 7 y la media fue 7 (7, 6, 8). */
  const hits = (finished: string[]): Args => {
    const ids = ['a', 'b', 'c'];
    return {
      ...empty,
      totalVotes: 3,
      userVotes: ids.map((id) => myVote(id, 7)),
      allRelevantVotes: ids.flatMap((id) => [
        relVote(id, 7, true),
        relVote(id, 6),
        relVote(id, 8),
      ]),
      finishedTortillaIds: finished,
    };
  };

  it('clavar la media final en 3 tortillas cerradas', () => {
    expect(unlockedMap(hits(['a', 'b', 'c'])).get('oracle')).toBe(true);
  });

  it('una tortilla aún abierta no cuenta: su media puede cambiar', () => {
    const result = computeAchievements(hits(['a', 'b']));
    expect(result.find((a) => a.id === 'oracle')).toMatchObject({
      unlocked: false,
      progress: 2,
      goal: 3,
    });
  });

  it('con menos de 3 votos la media no cuenta (sería tu propia nota)', () => {
    const args: Args = {
      ...empty,
      userVotes: ['a', 'b', 'c'].map((id) => myVote(id, 7)),
      allRelevantVotes: ['a', 'b', 'c'].map((id) => relVote(id, 7, true)),
      finishedTortillaIds: ['a', 'b', 'c'],
    };
    expect(unlockedMap(args).get('oracle')).toBe(false);
  });
});

describe('Madrugador y Rompehielos', () => {
  it('ser el primero en votar 3 tortillas', () => {
    const args: Args = {
      ...empty,
      allRelevantVotes: ['a', 'b', 'c'].flatMap((id) => [
        relVote(id, 7, true, at(0)),
        relVote(id, 7, false, at(5)),
      ]),
    };
    expect(unlockedMap(args).get('earlyBird')).toBe(true);
  });

  it('con empate en la hora no cuenta para nadie', () => {
    // Votos importados en bloque: todos con la misma fecha de alta.
    const args: Args = {
      ...empty,
      allRelevantVotes: ['a', 'b', 'c'].flatMap((id) => [
        relVote(id, 7, true, at(0)),
        relVote(id, 7, false, at(0)),
      ]),
    };
    expect(unlockedMap(args).get('earlyBird')).toBe(false);
  });

  it('el primer comentario de una tortilla', () => {
    const first: Args = {
      ...empty,
      relevantComments: [
        { tortillaId: 'a', createdAt: at(0), mine: true },
        { tortillaId: 'a', createdAt: at(3), mine: false },
      ],
    };
    expect(unlockedMap(first).get('icebreaker')).toBe(true);

    const second: Args = {
      ...empty,
      relevantComments: [
        { tortillaId: 'a', createdAt: at(0), mine: false },
        { tortillaId: 'a', createdAt: at(3), mine: true },
      ],
    };
    expect(unlockedMap(second).get('icebreaker')).toBe(false);
  });
});

describe('logros de calendario y sociales', () => {
  it('Doblete: dos tortillas del mismo día', () => {
    const same = unlockedMap({
      ...empty,
      userVotes: [
        myVote('a', 7, { tortillaDate: new Date('2026-10-14T10:00:00Z') }),
        myVote('b', 8, { tortillaDate: new Date('2026-10-14T15:00:00Z') }),
      ],
    });
    expect(same.get('doubleDay')).toBe(true);

    const apart = unlockedMap({
      ...empty,
      userVotes: [
        myVote('a', 7, { tortillaDate: day('2026-10-07') }),
        myVote('b', 8, { tortillaDate: day('2026-10-14') }),
      ],
    });
    expect(apart.get('doubleDay')).toBe(false);
  });

  it('Aniversario: un año entre la primera y la última tortilla votada', () => {
    const votes = (from: string) => [
      myVote('a', 7, { tortillaDate: day(from) }),
      myVote('b', 7, { tortillaDate: day('2026-10-14') }),
    ];
    expect(unlockedMap({ ...empty, userVotes: votes('2025-10-14') }).get('anniversary')).toBe(true);
    expect(unlockedMap({ ...empty, userVotes: votes('2025-10-16') }).get('anniversary')).toBe(false);
  });

  it('Fiel a la cita y Tertuliano cuentan con progreso', () => {
    const comments = Array.from({ length: 4 }, (_, i) => ({
      tortillaId: `t${i}`,
      createdAt: at(i),
      mine: true,
    }));
    const byId = new Map(
      computeAchievements({ ...empty, attendedEvents: 5, relevantComments: comments }).map(
        (a) => [a.id, a]
      )
    );
    expect(byId.get('eventRegular')).toMatchObject({ unlocked: true, progress: 5, goal: 5 });
    expect(byId.get('commenter')).toMatchObject({ unlocked: false, progress: 4, goal: 10 });
  });

  it('Expresivo: las cuatro reacciones', () => {
    const reactions = ['fire', 'yummy', 'meh', 'cringe'];
    const all = unlockedMap({
      ...empty,
      userVotes: reactions.map((reaction, i) => myVote(`t${i}`, 7, { reaction })),
    });
    expect(all.get('expressive')).toBe(true);

    const repeated = unlockedMap({
      ...empty,
      userVotes: ['fire', 'fire', 'meh', null].map((reaction, i) =>
        myVote(`t${i}`, 7, { reaction })
      ),
    });
    expect(repeated.get('expressive')).toBe(false);
  });
});

describe('unseenAchievements', () => {
  it('devuelve solo los desbloqueados que no se han visto', () => {
    const all = computeAchievements({ ...empty, totalVotes: 10 });
    const fresh = unseenAchievements(all, ['firstVote']);
    expect(fresh.map((a) => a.id)).toEqual(['tenVotes']);
  });

  it('no repite un logro visto aunque se perdiera y se recuperara', () => {
    const all = computeAchievements({ ...empty, totalVotes: 1 });
    expect(unseenAchievements(all, ['firstVote', 'firstLowballer'])).toEqual([]);
  });
});

describe('progreso de los logros', () => {
  it('los de umbral cuentan hasta la meta y no la pasan', () => {
    const byId = new Map(
      computeAchievements({ ...empty, totalVotes: 12, bestStreak: 4 }).map((a) => [a.id, a])
    );
    expect(byId.get('tenVotes')).toMatchObject({ progress: 10, goal: 10 });
    expect(byId.get('fiftyVotes')).toMatchObject({ progress: 12, goal: 50 });
    expect(byId.get('streak5')).toMatchObject({ progress: 4, goal: 5 });
  });

  it('los de sí/no no tienen progreso', () => {
    const perfect = computeAchievements(empty).find((a) => a.id === 'perfectScore');
    expect(perfect).toMatchObject({ progress: null, goal: null });
  });
});

describe('traducciones', () => {
  // El nombre y la descripción salen de i18n por id: un logro sin traducir
  // se vería como la clave en crudo.
  it('todos los logros tienen título y descripción en cada idioma', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const id of ACHIEVEMENT_IDS) {
        for (const field of ['title', 'description']) {
          const key = `achievement.${id}.${field}` as TranslationKey;
          expect(dictionaries[lang][key], `${lang}: ${key}`).toBeTruthy();
        }
      }
    }
  });
});
