/**
 * Grupos (peñas): validación de nombres, slugs, rutas y reglas de roles.
 *
 * Lógica pura, sin BD: la usan tanto los resolvers como el frontend.
 */

export const GROUP_ROLES = ['member', 'admin'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const MIN_GROUP_NAME_LENGTH = 2;
export const MAX_GROUP_NAME_LENGTH = 40;
export const MAX_GROUP_DESCRIPTION_LENGTH = 200;
export const MAX_SLUG_LENGTH = 40;

/** Slug de respaldo cuando el nombre no tiene ningún carácter aprovechable. */
const FALLBACK_SLUG = 'grupo';

export function isGroupRole(value: string): value is GroupRole {
  return (GROUP_ROLES as readonly string[]).includes(value);
}

/** Recorta y colapsa espacios. Lanza si queda demasiado corto o largo. */
export function normalizeGroupName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < MIN_GROUP_NAME_LENGTH) {
    throw new Error(
      `El nombre del grupo debe tener al menos ${MIN_GROUP_NAME_LENGTH} caracteres.`
    );
  }
  if (name.length > MAX_GROUP_NAME_LENGTH) {
    throw new Error(
      `El nombre del grupo no puede superar ${MAX_GROUP_NAME_LENGTH} caracteres.`
    );
  }
  return name;
}

/** Recorta y convierte el texto vacío en `null`. Lanza si es demasiado largo. */
export function normalizeGroupDescription(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_GROUP_DESCRIPTION_LENGTH) {
    throw new Error(
      `La descripción no puede superar ${MAX_GROUP_DESCRIPTION_LENGTH} caracteres.`
    );
  }
  return trimmed;
}

/**
 * Slug para la URL a partir del nombre: sin acentos, en minúsculas y con
 * guiones. "Peña de l'Àngel" → "pena-de-l-angel".
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
  return slug || FALLBACK_SLUG;
}

/**
 * Primer slug libre: `base`, `base-2`, `base-3`… Recorta la base si hace falta
 * para que el sufijo no pase del máximo.
 */
export function pickAvailableSlug(
  base: string,
  taken: ReadonlySet<string>
): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const head = base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, '');
    const candidate = `${head}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type GroupSection =
  | 'vote'
  | 'history'
  | 'admin'
  | 'members'
  | 'profile';

/** Ruta dentro de un grupo: `/g/<slug>` o `/g/<slug>/<sección>`. */
export function groupPath(slug: string, section?: GroupSection): string {
  const base = `/g/${encodeURIComponent(slug)}`;
  return section ? `${base}/${section}` : base;
}

/** Perfil de un usuario dentro de un grupo. */
export function groupProfilePath(slug: string, userName: string): string {
  return `${groupPath(slug, 'profile')}/${encodeURIComponent(userName)}`;
}

type MemberRole = { userKey: string; role: GroupRole };

/**
 * `true` si aplicar el cambio dejaría al grupo sin ningún admin. `role: null`
 * significa que la persona sale del grupo (la echan o se va).
 *
 * Un grupo sin admins no puede convocar, subir tortillas ni invitar a nadie, y
 * nadie podría arreglarlo sin tocar la BD a mano.
 */
export function leavesGroupWithoutAdmin(
  members: readonly MemberRole[],
  change: { userKey: string; role: GroupRole | null }
): boolean {
  const adminsAfter = members.filter((m) =>
    m.userKey === change.userKey ? change.role === 'admin' : m.role === 'admin'
  );
  return adminsAfter.length === 0;
}
