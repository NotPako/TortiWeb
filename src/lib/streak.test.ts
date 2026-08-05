import { describe, it, expect } from 'vitest';
import { computeStreaks, type StreakTortilla } from './streak';

/** Mediodía, para que la clave de día no baile con la zona horaria. */
function at(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

/** Tres miércoles consecutivos, del más antiguo al más reciente. */
const w1 = at('2026-06-03');
const w2 = at('2026-06-10');
const w3 = at('2026-06-17');

/** `now` fijo a un día sin tortilla, para no activar la gracia de "hoy". */
const laterDay = at('2026-06-20');

describe('computeStreaks — una tortilla por día', () => {
  const tortillas: StreakTortilla[] = [
    { id: 'a', date: w1 },
    { id: 'b', date: w2 },
    { id: 'c', date: w3 },
  ];

  it('cuenta los días consecutivos votados', () => {
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'b', 'c'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(3);
    expect(r.bestStreak).toBe(3);
  });

  it('un día sin votar corta la racha actual', () => {
    // Votó el más antiguo y el más reciente, faltó el de en medio.
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'c'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(1);
    expect(r.bestStreak).toBe(1);
  });

  it('sin votos, racha cero', () => {
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: [],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(0);
    expect(r.bestStreak).toBe(0);
  });

  it('la mejor racha sobrevive aunque la actual se haya cortado', () => {
    const cuatro: StreakTortilla[] = [
      ...tortillas,
      { id: 'd', date: at('2026-06-24') },
    ];
    // Votó los tres primeros y falló el último: la actual cae a 0, la mejor queda en 3.
    const r = computeStreaks({
      tortillas: cuatro,
      votedTortillaIds: ['a', 'b', 'c'],
      now: at('2026-06-27'),
    });
    expect(r.currentStreak).toBe(0);
    expect(r.bestStreak).toBe(3);
  });
});

describe('computeStreaks — varias tortillas el mismo día', () => {
  // El día w2 se cocinaron dos tortillas distintas.
  const tortillas: StreakTortilla[] = [
    { id: 'a', date: w1 },
    { id: 'b1', date: w2 },
    { id: 'b2', date: w2 },
    { id: 'c', date: w3 },
  ];

  it('votar UNA de las dos ya cuenta el día', () => {
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'b1', 'c'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(3);
    expect(r.bestStreak).toBe(3);
  });

  it('votar las dos cuenta igual: el día es la unidad, no la tortilla', () => {
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'b1', 'b2', 'c'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(3);
    expect(r.bestStreak).toBe(3);
  });

  it('no votar ninguna de las dos sí corta la racha', () => {
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'c'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(1);
    expect(r.bestStreak).toBe(1);
  });
});

describe('computeStreaks — gracia del día en curso', () => {
  const tortillas: StreakTortilla[] = [
    { id: 'a', date: w1 },
    { id: 'b', date: w2 },
    { id: 'c', date: w3 },
  ];

  it('la tortilla de hoy sin votar no rompe la racha', () => {
    // `now` es el mismo día que w3 y no la ha votado: se ignora ese día.
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'b'],
      now: w3,
    });
    expect(r.currentStreak).toBe(2);
  });

  it('si hoy hay dos tortillas y no vota ninguna, tampoco rompe', () => {
    const dosHoy: StreakTortilla[] = [
      { id: 'a', date: w1 },
      { id: 'b', date: w2 },
      { id: 'c1', date: w3 },
      { id: 'c2', date: w3 },
    ];
    const r = computeStreaks({
      tortillas: dosHoy,
      votedTortillaIds: ['a', 'b'],
      now: w3,
    });
    expect(r.currentStreak).toBe(2);
  });

  it('votar hoy suma al momento', () => {
    const r = computeStreaks({
      tortillas,
      votedTortillaIds: ['a', 'b', 'c'],
      now: w3,
    });
    expect(r.currentStreak).toBe(3);
  });
});

describe('computeStreaks — casos límite', () => {
  it('sin tortillas devuelve ceros', () => {
    const r = computeStreaks({ tortillas: [], votedTortillaIds: [] });
    expect(r).toEqual({ currentStreak: 0, bestStreak: 0 });
  });

  it('no depende del orden de entrada', () => {
    const desordenadas: StreakTortilla[] = [
      { id: 'c', date: w3 },
      { id: 'a', date: w1 },
      { id: 'b', date: w2 },
    ];
    const r = computeStreaks({
      tortillas: desordenadas,
      votedTortillaIds: ['a', 'b', 'c'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(3);
  });

  it('ignora ids votados que no correspondan a ninguna tortilla', () => {
    const r = computeStreaks({
      tortillas: [{ id: 'a', date: w1 }],
      votedTortillaIds: ['a', 'fantasma'],
      now: laterDay,
    });
    expect(r.currentStreak).toBe(1);
  });
});
