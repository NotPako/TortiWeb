import { describe, it, expect } from 'vitest';
import {
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  groupPath,
  groupProfilePath,
  isGroupRole,
  leavesGroupWithoutAdmin,
  normalizeGroupDescription,
  normalizeGroupName,
  pickAvailableSlug,
  slugify,
} from './groups';

describe('normalizeGroupName', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeGroupName('  Peña   del   miércoles ')).toBe(
      'Peña del miércoles'
    );
  });

  it('lanza si es demasiado corto o largo', () => {
    expect(() => normalizeGroupName(' a ')).toThrow();
    expect(() => normalizeGroupName('a'.repeat(MAX_GROUP_NAME_LENGTH + 1))).toThrow();
    expect(normalizeGroupName('a'.repeat(MAX_GROUP_NAME_LENGTH))).toHaveLength(
      MAX_GROUP_NAME_LENGTH
    );
  });
});

describe('normalizeGroupDescription', () => {
  it('convierte vacío o null en null', () => {
    expect(normalizeGroupDescription('   ')).toBeNull();
    expect(normalizeGroupDescription(null)).toBeNull();
  });

  it('lanza si supera el máximo', () => {
    expect(() =>
      normalizeGroupDescription('a'.repeat(MAX_GROUP_DESCRIPTION_LENGTH + 1))
    ).toThrow();
  });
});

describe('slugify', () => {
  it('quita acentos, apóstrofos y mayúsculas', () => {
    expect(slugify("Peña de l'Àngel")).toBe('pena-de-l-angel');
  });

  it('no deja guiones al principio ni al final', () => {
    expect(slugify('  ¡¡Truita!!  ')).toBe('truita');
  });

  it('usa un respaldo si no queda nada', () => {
    expect(slugify('🍳🍳')).toBe('grupo');
  });

  it('respeta la longitud máxima sin acabar en guion', () => {
    const slug = slugify(`${'a'.repeat(MAX_SLUG_LENGTH - 1)} b`);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('pickAvailableSlug', () => {
  it('devuelve la base si está libre', () => {
    expect(pickAvailableSlug('pena', new Set())).toBe('pena');
  });

  it('añade el primer sufijo libre', () => {
    expect(pickAvailableSlug('pena', new Set(['pena', 'pena-2']))).toBe('pena-3');
  });

  it('recorta la base para no pasar del máximo', () => {
    const base = 'a'.repeat(MAX_SLUG_LENGTH);
    const slug = pickAvailableSlug(base, new Set([base]));
    expect(slug).toHaveLength(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-2')).toBe(true);
  });
});

describe('rutas', () => {
  it('construye rutas del grupo escapando el slug y el usuario', () => {
    expect(groupPath('pena')).toBe('/g/pena');
    expect(groupPath('pena', 'vote')).toBe('/g/pena/vote');
    expect(groupProfilePath('pena', 'Ana María')).toBe(
      '/g/pena/profile/Ana%20Mar%C3%ADa'
    );
  });
});

describe('isGroupRole', () => {
  it('solo acepta member y admin', () => {
    expect(isGroupRole('admin')).toBe(true);
    expect(isGroupRole('member')).toBe(true);
    expect(isGroupRole('owner')).toBe(false);
  });
});

describe('leavesGroupWithoutAdmin', () => {
  const members = [
    { userKey: 'ana', role: 'admin' as const },
    { userKey: 'vic', role: 'member' as const },
  ];

  it('detecta degradar al único admin', () => {
    expect(
      leavesGroupWithoutAdmin(members, { userKey: 'ana', role: 'member' })
    ).toBe(true);
  });

  it('detecta que salga el único admin', () => {
    expect(leavesGroupWithoutAdmin(members, { userKey: 'ana', role: null })).toBe(
      true
    );
  });

  it('permite cambios que no tocan al último admin', () => {
    expect(leavesGroupWithoutAdmin(members, { userKey: 'vic', role: null })).toBe(
      false
    );
    expect(
      leavesGroupWithoutAdmin(members, { userKey: 'vic', role: 'admin' })
    ).toBe(false);
  });

  it('permite degradar a un admin si queda otro', () => {
    const two = [...members, { userKey: 'pako', role: 'admin' as const }];
    expect(leavesGroupWithoutAdmin(two, { userKey: 'ana', role: 'member' })).toBe(
      false
    );
  });
});
