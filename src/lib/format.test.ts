import { describe, it, expect } from 'vitest';
import { fmt } from './format';

describe('fmt', () => {
  it('usa un decimal con coma', () => {
    expect(fmt(7.5)).toBe('7,5');
    expect(fmt(8.4)).toBe('8,4');
  });

  it('rellena el decimal en enteros', () => {
    expect(fmt(10)).toBe('10,0');
    expect(fmt(0)).toBe('0,0');
  });

  it('redondea a un decimal', () => {
    expect(fmt(8.46)).toBe('8,5');
    expect(fmt(8.44)).toBe('8,4');
  });
});
