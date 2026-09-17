import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AFTER_LOGIN,
  safeCallbackUrl,
  withCallbackUrl,
} from './navigation';

describe('safeCallbackUrl', () => {
  it('acepta rutas internas', () => {
    expect(safeCallbackUrl('/join/ABCDEFGH')).toBe('/join/ABCDEFGH');
  });

  it('rechaza URLs externas y protocol-relative', () => {
    expect(safeCallbackUrl('https://malo.example')).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeCallbackUrl('//malo.example')).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeCallbackUrl('/\\malo.example')).toBe(DEFAULT_AFTER_LOGIN);
  });

  it('usa el respaldo si no hay valor', () => {
    expect(safeCallbackUrl(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeCallbackUrl('', '/otra')).toBe('/otra');
  });
});

describe('withCallbackUrl', () => {
  it('no ensucia la URL con el destino por defecto', () => {
    expect(withCallbackUrl('/register', DEFAULT_AFTER_LOGIN)).toBe('/register');
  });

  it('codifica el destino', () => {
    expect(withCallbackUrl('/register', '/join/AB CD')).toBe(
      '/register?callbackUrl=%2Fjoin%2FAB%20CD'
    );
  });
});
