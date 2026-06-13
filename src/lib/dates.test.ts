import { describe, it, expect } from 'vitest';
import { isSameDay, nextWednesday } from './dates';

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
