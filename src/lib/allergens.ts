/**
 * Alérgenos e intolerancias de los usuarios.
 *
 * La lista son los 14 alérgenos de declaración obligatoria en la UE
 * (Reglamento 1169/2011, anexo II). Usar la lista oficial en vez de texto libre
 * permite traducirlos, resumirlos y que "celiaco", "sin gluten" y "gluten" no
 * acaben siendo tres cosas distintas. Lo que no encaje va en `allergyNotes`.
 *
 * El orden del array es el orden canónico en el que se guardan y se muestran.
 */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'walnuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

export type AllergenId = (typeof ALLERGENS)[number];

export const MAX_ALLERGY_NOTES_LENGTH = 200;

export function isAllergenId(value: string): value is AllergenId {
  return (ALLERGENS as readonly string[]).includes(value);
}

/**
 * Valida, quita duplicados y ordena según la lista oficial. Lanza si llega un
 * id desconocido: preferimos un error claro a descartarlo en silencio y que el
 * usuario crea que lo ha guardado.
 */
export function normalizeAllergens(values: readonly string[]): AllergenId[] {
  const unknown = values.filter((v) => !isAllergenId(v));
  if (unknown.length > 0) {
    throw new Error(`Alérgeno no válido: ${unknown.join(', ')}.`);
  }
  const selected = new Set(values);
  return ALLERGENS.filter((id) => selected.has(id));
}

/** Recorta espacios y convierte el texto vacío en `null`. Lanza si es demasiado largo. */
export function normalizeAllergyNotes(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_ALLERGY_NOTES_LENGTH) {
    throw new Error(
      `Las observaciones no pueden superar ${MAX_ALLERGY_NOTES_LENGTH} caracteres.`
    );
  }
  return trimmed;
}

/** `true` si la persona ha indicado algún alérgeno u observación. */
export function hasAllergies(person: {
  allergens: readonly AllergenId[] | null;
  allergyNotes: string | null;
}): boolean {
  return (person.allergens?.length ?? 0) > 0 || Boolean(person.allergyNotes);
}

/**
 * Resumen por alérgeno para quien cocina: quiénes lo tienen, en el orden
 * oficial y omitiendo los que no afectan a nadie.
 */
export function summarizeAllergens(
  people: ReadonlyArray<{ userName: string; allergens: readonly AllergenId[] }>
): Array<{ allergen: AllergenId; userNames: string[] }> {
  return ALLERGENS.map((allergen) => ({
    allergen,
    userNames: people
      .filter((p) => p.allergens.includes(allergen))
      .map((p) => p.userName),
  })).filter((entry) => entry.userNames.length > 0);
}
