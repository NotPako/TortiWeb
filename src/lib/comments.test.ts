import { describe, it, expect } from 'vitest';
import { normalizeCommentText, MAX_COMMENT_LENGTH } from './comments';

describe('normalizeCommentText', () => {
  it('colapsa saltos de línea consecutivos en uno solo', () => {
    const input = 'Hola\n\n\n\n\n\n\nadiós';
    expect(normalizeCommentText(input)).toBe('Hola\nadiós');
  });

  it('reduce a la práctica el comentario gigante a base de saltos', () => {
    const input = '\n'.repeat(40) + 'Pako' + '\n'.repeat(40) + 'arregla esto';
    const out = normalizeCommentText(input);
    expect(out).toBe('Pako\narregla esto');
    // Sin saltos consecutivos en el resultado.
    expect(/\n\n/.test(out)).toBe(false);
  });

  it('normaliza CRLF y quita espacios al final de línea', () => {
    expect(normalizeCommentText('a  \r\n  \r\nb')).toBe('a\nb');
  });

  it('un texto solo de saltos/espacios queda vacío', () => {
    expect(normalizeCommentText('\n\n   \n\t\n')).toBe('');
  });

  it('preserva un salto de línea simple y el contenido', () => {
    expect(normalizeCommentText('línea 1\nlínea 2')).toBe('línea 1\nlínea 2');
  });

  it('el límite es el de Twitter (280)', () => {
    expect(MAX_COMMENT_LENGTH).toBe(280);
  });
});
