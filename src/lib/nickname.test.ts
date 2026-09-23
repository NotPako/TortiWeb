import { describe, it, expect } from 'vitest';
import {
  MAX_NICKNAME_CHANGES,
  nicknameChangesLeft,
  normalizeNickname,
  planNicknameChange,
  validateNickname,
} from './nickname';

describe('validateNickname', () => {
  it('recorta espacios y acepta los caracteres permitidos', () => {
    expect(validateNickname('  Pako_99.x-y ')).toBe('Pako_99.x-y');
  });

  it('rechaza nombres demasiado cortos, largos o con caracteres raros', () => {
    expect(() => validateNickname('a')).toThrow();
    expect(() => validateNickname('a'.repeat(21))).toThrow();
    expect(() => validateNickname('con espacio')).toThrow();
    expect(() => validateNickname('emoji🍳')).toThrow();
  });
});

describe('nicknameChangesLeft', () => {
  it('cuenta hacia atrás y no baja de cero', () => {
    expect(nicknameChangesLeft(0)).toBe(MAX_NICKNAME_CHANGES);
    expect(nicknameChangesLeft(MAX_NICKNAME_CHANGES)).toBe(0);
    expect(nicknameChangesLeft(MAX_NICKNAME_CHANGES + 5)).toBe(0);
  });
});

describe('planNicknameChange', () => {
  it('el mismo nombre exacto no es ningún cambio', () => {
    expect(
      planNicknameChange({ current: 'Pako', requested: ' Pako ', used: 3 })
    ).toMatchObject({ kind: 'unchanged', username: 'Pako' });
  });

  it('cambiar solo mayúsculas no gasta cambios, ni con el cupo agotado', () => {
    expect(
      planNicknameChange({
        current: 'pako',
        requested: 'PaKo',
        used: MAX_NICKNAME_CHANGES,
      })
    ).toMatchObject({ kind: 'caseOnly', username: 'PaKo', usernameKey: 'pako' });
  });

  it('un nombre distinto es un cambio mientras queden', () => {
    expect(
      planNicknameChange({ current: 'Pako', requested: 'Pakito', used: 2 })
    ).toMatchObject({ kind: 'rename', usernameKey: 'pakito' });
  });

  it('lanza cuando ya se han gastado los cambios', () => {
    expect(() =>
      planNicknameChange({
        current: 'Pako',
        requested: 'Pakito',
        used: MAX_NICKNAME_CHANGES,
      })
    ).toThrow(/no te quedan/i);
  });

  it('valida el formato antes que nada', () => {
    expect(() =>
      planNicknameChange({ current: 'Pako', requested: 'a', used: 0 })
    ).toThrow(/entre 2 y 20/i);
  });
});

describe('normalizeNickname', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(normalizeNickname('  PaKo  ')).toBe('pako');
  });
});
