import { describe, it, expect } from 'vitest';
import { matchesAllTokens, normalizeForSearch, toSearchTokens } from './search';

describe('normalizeForSearch', () => {
  it('pasa a minúsculas', () => {
    expect(normalizeForSearch('Tortilla DE Patata')).toBe('tortilla de patata');
  });

  it('quita tildes y diéresis', () => {
    expect(normalizeForSearch('Calabacín')).toBe('calabacin');
    expect(normalizeForSearch('Jamón')).toBe('jamon');
    expect(normalizeForSearch('pingüino')).toBe('pinguino');
  });

  it('pliega la ñ a n', () => {
    // Decisión deliberada: en búsqueda interesa ser permisivo (es lo que hace
    // el `asciifolding` clásico), para que quien escriba "nino" encuentre
    // "niño" sin pelearse con el teclado.
    expect(normalizeForSearch('Ñora')).toBe('nora');
    expect(matchesAllTokens('Tortilla de niño', ['nino'])).toBe(true);
  });

  it('recorta espacios sobrantes', () => {
    expect(normalizeForSearch('  cebolla  ')).toBe('cebolla');
  });
});

describe('toSearchTokens', () => {
  it('parte por espacios', () => {
    expect(toSearchTokens('tortilla cebolla')).toEqual(['tortilla', 'cebolla']);
  });

  it('colapsa espacios múltiples', () => {
    expect(toSearchTokens('  con    cebolla ')).toEqual(['con', 'cebolla']);
  });

  it('devuelve [] con consulta vacía o de solo espacios', () => {
    expect(toSearchTokens('')).toEqual([]);
    expect(toSearchTokens('    ')).toEqual([]);
  });

  it('normaliza cada palabra', () => {
    expect(toSearchTokens('Jamón CALABACÍN')).toEqual(['jamon', 'calabacin']);
  });
});

describe('matchesAllTokens', () => {
  const text = 'Tortilla de patata con cebolla y jamón';

  it('sin palabras no filtra', () => {
    expect(matchesAllTokens(text, [])).toBe(true);
  });

  it('casa una palabra suelta', () => {
    expect(matchesAllTokens(text, ['cebolla'])).toBe(true);
  });

  it('exige todas las palabras (AND)', () => {
    expect(matchesAllTokens(text, ['patata', 'cebolla'])).toBe(true);
    expect(matchesAllTokens(text, ['patata', 'chorizo'])).toBe(false);
  });

  it('no depende del orden', () => {
    expect(matchesAllTokens(text, ['cebolla', 'patata'])).toBe(true);
  });

  it('casa por subcadena (prefijos parciales)', () => {
    expect(matchesAllTokens(text, ['cebo'])).toBe(true);
  });

  it('ignora acentos en ambos lados', () => {
    expect(matchesAllTokens(text, ['jamon'])).toBe(true);
    expect(matchesAllTokens('Tortilla de jamon', ['jamón'])).toBe(true);
  });

  it('ignora mayúsculas', () => {
    expect(matchesAllTokens(text, ['TORTILLA'])).toBe(true);
  });
});
