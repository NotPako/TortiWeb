import { describe, it, expect } from 'vitest';
import { daysUntil, isSameDay, nextWednesday } from './dates';

// 2026-06-10 es miércoles; 2026-06-11 jueves; 2026-06-17 el siguiente miércoles.
describe('nextWednesday', () => {
  it('devuelve hoy si ya es miércoles', () => {
    const wed = new Date(2026, 5, 10, 9, 0, 0); // mes 5 = junio
    const r = nextWednesday(wed);
    expect(r.getDay()).toBe(3);
    expect(r.getDate()).toBe(10);
  });

  it('salta al próximo miércoles desde un jueves', () => {
    const thu = new Date(2026, 5, 11, 9, 0, 0);
    const r = nextWednesday(thu);
    expect(r.getDay()).toBe(3);
    expect(r.getDate()).toBe(17);
  });

  it('fija la hora a mediodía', () => {
    const r = nextWednesday(new Date(2026, 5, 11, 23, 30, 0));
    expect(r.getHours()).toBe(12);
    expect(r.getMinutes()).toBe(0);
  });
});

describe('isSameDay', () => {
  it('true para dos horas del mismo día', () => {
    const a = new Date(2026, 5, 10, 8, 0, 0);
    const b = new Date(2026, 5, 10, 20, 0, 0);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('false para días distintos', () => {
    const a = new Date(2026, 5, 10, 12, 0, 0);
    const b = new Date(2026, 5, 11, 12, 0, 0);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe('daysUntil', () => {
  it('cuenta días naturales en Madrid', () => {
    const from = new Date('2026-10-14T10:00:00Z'); // miércoles
    expect(daysUntil(new Date('2026-10-14T20:00:00Z'), from)).toBe(0);
    expect(daysUntil(new Date('2026-10-15T08:00:00Z'), from)).toBe(1);
    expect(daysUntil(new Date('2026-10-21T12:00:00Z'), from)).toBe(7);
    expect(daysUntil(new Date('2026-10-13T12:00:00Z'), from)).toBe(-1);
  });

  it('usa el día de Madrid aunque en UTC aún sea el anterior', () => {
    // 23:30 UTC del 13 = 01:30 del 14 en Madrid.
    const from = new Date('2026-10-13T23:30:00Z');
    expect(daysUntil(new Date('2026-10-14T12:00:00Z'), from)).toBe(0);
  });

  it('no se descuadra con el cambio de hora', () => {
    // El 25 de octubre de 2026 el día dura 25 h en Madrid.
    const from = new Date('2026-10-24T12:00:00Z');
    expect(daysUntil(new Date('2026-10-28T12:00:00Z'), from)).toBe(4);
  });
});
