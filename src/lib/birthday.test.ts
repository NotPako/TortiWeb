import { describe, it, expect } from 'vitest';
import {
  birthdayFromDraft,
  birthdaysCelebratedOn,
  formatBirthday,
  isIncompleteBirthday,
  todayInTimeZone,
  validateBirthday,
} from './birthday';

describe('validateBirthday', () => {
  it('acepta fechas reales, incluido el 29 de febrero', () => {
    expect(validateBirthday({ day: 14, month: 10 })).toEqual({ day: 14, month: 10 });
    expect(validateBirthday({ day: 29, month: 2 })).toEqual({ day: 29, month: 2 });
  });

  it('rechaza días o meses imposibles', () => {
    expect(() => validateBirthday({ day: 30, month: 2 })).toThrow(/día/);
    expect(() => validateBirthday({ day: 31, month: 4 })).toThrow(/día/);
    expect(() => validateBirthday({ day: 0, month: 1 })).toThrow(/día/);
    expect(() => validateBirthday({ day: 1.5, month: 1 })).toThrow(/día/);
    expect(() => validateBirthday({ day: 1, month: 13 })).toThrow(/mes/);
  });
});

describe('todayInTimeZone', () => {
  it('usa el día de Madrid, no el de UTC', () => {
    // 23:30 UTC del 13 de octubre = 01:30 del 14 en Madrid (horario de verano).
    const now = new Date(Date.UTC(2026, 9, 13, 23, 30));
    expect(todayInTimeZone(now)).toEqual({ year: 2026, month: 10, day: 14 });
  });
});

describe('birthdaysCelebratedOn', () => {
  it('un día normal solo celebra ese día', () => {
    expect(birthdaysCelebratedOn({ year: 2026, month: 10, day: 14 })).toEqual([
      { day: 14, month: 10 },
    ]);
  });

  it('el 28 de febrero de un año no bisiesto también celebra el 29', () => {
    expect(birthdaysCelebratedOn({ year: 2027, month: 2, day: 28 })).toEqual([
      { day: 28, month: 2 },
      { day: 29, month: 2 },
    ]);
  });

  it('en año bisiesto el 29 tiene su propio día', () => {
    expect(birthdaysCelebratedOn({ year: 2028, month: 2, day: 28 })).toEqual([
      { day: 28, month: 2 },
    ]);
  });
});

describe('borrador del formulario', () => {
  it('vacío no está a medias y no guarda nada', () => {
    expect(isIncompleteBirthday(null)).toBe(false);
    expect(isIncompleteBirthday({ day: null, month: null })).toBe(false);
    expect(birthdayFromDraft({ day: null, month: null })).toBeNull();
  });

  it('solo día o solo mes está a medias', () => {
    expect(isIncompleteBirthday({ day: 3, month: null })).toBe(true);
    expect(isIncompleteBirthday({ day: null, month: 3 })).toBe(true);
    expect(birthdayFromDraft({ day: 3, month: null })).toBeNull();
  });

  it('completo se convierte en cumpleaños', () => {
    expect(birthdayFromDraft({ day: 3, month: 7 })).toEqual({ day: 3, month: 7 });
  });
});

describe('formatBirthday', () => {
  it('formatea en el idioma pedido, sin año', () => {
    expect(formatBirthday({ day: 14, month: 10 }, 'es-ES')).toBe('14 de octubre');
    expect(formatBirthday({ day: 29, month: 2 }, 'es-ES')).toBe('29 de febrero');
  });
});
