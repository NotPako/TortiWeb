import { describe, it, expect } from 'vitest';
import { Kind, type EnumTypeDefinitionNode } from 'graphql';
import { typeDefs } from '@/graphql/typeDefs';
import {
  SUPPORTED_LANGUAGES,
  dictionaries,
  type TranslationKey,
} from '@/lib/i18n';
import {
  ALLERGENS,
  MAX_ALLERGY_NOTES_LENGTH,
  hasAllergies,
  isAllergenId,
  normalizeAllergens,
  normalizeAllergyNotes,
  summarizeAllergens,
} from './allergens';

describe('ALLERGENS', () => {
  it('son los 14 oficiales de la UE más las nueces, sin repetir', () => {
    expect(ALLERGENS).toHaveLength(15);
    expect(new Set(ALLERGENS).size).toBe(15);
    expect(ALLERGENS).toContain('nuts');
    expect(ALLERGENS).toContain('walnuts');
  });

  it('coincide exactamente con el enum Allergen de GraphQL', () => {
    // Si se añade un alérgeno solo en uno de los dos sitios, GraphQL rechaza
    // el valor al guardar. Este test lo detecta antes de llegar a producción.
    const enumDef = typeDefs.definitions.find(
      (d): d is EnumTypeDefinitionNode =>
        d.kind === Kind.ENUM_TYPE_DEFINITION && d.name.value === 'Allergen'
    );
    const values = enumDef?.values?.map((v) => v.name.value) ?? [];
    expect(values).toEqual([...ALLERGENS]);
  });

  it('cada alérgeno tiene traducción en todos los idiomas', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const id of ALLERGENS) {
        const key = `allergen.${id}` as TranslationKey;
        expect(dictionaries[lang][key], `${lang}: ${key}`).toBeTruthy();
      }
    }
  });
});

describe('isAllergenId', () => {
  it('reconoce ids válidos y rechaza el resto', () => {
    expect(isAllergenId('gluten')).toBe(true);
    expect(isAllergenId('Gluten')).toBe(false);
    expect(isAllergenId('chocolate')).toBe(false);
  });
});

describe('normalizeAllergens', () => {
  it('ordena según la lista oficial', () => {
    expect(normalizeAllergens(['milk', 'gluten', 'eggs'])).toEqual([
      'gluten',
      'eggs',
      'milk',
    ]);
  });

  it('quita duplicados', () => {
    expect(normalizeAllergens(['eggs', 'eggs'])).toEqual(['eggs']);
  });

  it('acepta la lista vacía', () => {
    expect(normalizeAllergens([])).toEqual([]);
  });

  it('lanza con un id desconocido en vez de ignorarlo', () => {
    expect(() => normalizeAllergens(['gluten', 'chocolate'])).toThrow(
      /chocolate/
    );
  });
});

describe('normalizeAllergyNotes', () => {
  it('recorta espacios', () => {
    expect(normalizeAllergyNotes('  kiwi  ')).toBe('kiwi');
  });

  it('convierte vacío, espacios o null en null', () => {
    expect(normalizeAllergyNotes('')).toBeNull();
    expect(normalizeAllergyNotes('   ')).toBeNull();
    expect(normalizeAllergyNotes(null)).toBeNull();
    expect(normalizeAllergyNotes(undefined)).toBeNull();
  });

  it('acepta el máximo y lanza si lo supera', () => {
    const max = 'a'.repeat(MAX_ALLERGY_NOTES_LENGTH);
    expect(normalizeAllergyNotes(max)).toBe(max);
    expect(() => normalizeAllergyNotes(`${max}a`)).toThrow();
  });
});

describe('hasAllergies', () => {
  it('true con alérgenos o con observaciones', () => {
    expect(hasAllergies({ allergens: ['eggs'], allergyNotes: null })).toBe(true);
    expect(hasAllergies({ allergens: [], allergyNotes: 'kiwi' })).toBe(true);
  });

  it('false sin nada, o si no hay permiso para verlo (null)', () => {
    expect(hasAllergies({ allergens: [], allergyNotes: null })).toBe(false);
    expect(hasAllergies({ allergens: null, allergyNotes: null })).toBe(false);
  });
});

describe('summarizeAllergens', () => {
  it('agrupa por alérgeno en orden oficial y omite los vacíos', () => {
    const summary = summarizeAllergens([
      { userName: 'Ana', allergens: ['milk', 'gluten'] },
      { userName: 'Vic', allergens: ['gluten'] },
      { userName: 'Pako', allergens: [] },
    ]);
    expect(summary).toEqual([
      { allergen: 'gluten', userNames: ['Ana', 'Vic'] },
      { allergen: 'milk', userNames: ['Ana'] },
    ]);
  });

  it('sin personas devuelve lista vacía', () => {
    expect(summarizeAllergens([])).toEqual([]);
  });
});
