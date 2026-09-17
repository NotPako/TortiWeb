import { Types } from 'mongoose';
import { Group, type GroupDocument } from '@/models/Group';
import { Membership, type MembershipDocument } from '@/models/Membership';
import {
  requireUser,
  sessionUser,
  type GqlContext,
  type SessionUser,
} from './context';

/**
 * Autorización por grupo.
 *
 * Invariante: ningún resolver toca `Tortilla`, `Vote`, `Comment` ni
 * `TortillaEvent` sin pasar antes por `requireGroupAccess` o
 * `requireGroupAdmin`, y el id del grupo con el que filtra sale del `group`
 * que devuelven estos helpers, nunca directamente de los argumentos.
 *
 * Los resolvers de campo (`Tortilla.votes`, `Tortilla.comments`…) no vuelven a
 * comprobar: heredan el permiso de la query que resolvió al padre.
 */

/** Por slug (queries de listado) o por id (entidades que ya saben su grupo). */
export type GroupRef = { slug: string } | { id: Types.ObjectId | string };

export type GroupAccess = {
  group: GroupDocument;
  membership: MembershipDocument;
  /** Leído de la BD en esta petición, no del JWT. */
  isAdmin: boolean;
  user: SessionUser;
};

export const GROUP_NOT_FOUND = 'Grupo no encontrado.';
const NOT_GROUP_ADMIN = 'No tienes permisos de administrador en este grupo.';

async function findGroup(ref: GroupRef): Promise<GroupDocument | null> {
  if ('slug' in ref) {
    return Group.findOne({ slug: ref.slug.trim().toLowerCase() }).exec();
  }
  if (!Types.ObjectId.isValid(ref.id)) return null;
  return Group.findById(ref.id).exec();
}

/**
 * Acceso del usuario de la sesión al grupo, o `null`. Sin sesión, grupo
 * inexistente y "no eres miembro" dan lo mismo a propósito: a quien no es
 * miembro no le revelamos que el grupo existe.
 */
export async function findGroupAccess(
  ctx: GqlContext,
  ref: GroupRef
): Promise<GroupAccess | null> {
  const user = sessionUser(ctx);
  if (!user) return null;
  const group = await findGroup(ref);
  if (!group) return null;
  const membership = await Membership.findOne({
    group: group._id,
    userKey: user.userKey,
  }).exec();
  if (!membership) return null;
  return { group, membership, isAdmin: membership.role === 'admin', user };
}

/**
 * Exige ser miembro. `notFoundMessage` permite fallar con el mensaje de la
 * entidad pedida ("Tortilla no encontrada.") en vez de mencionar el grupo.
 */
export async function requireGroupAccess(
  ctx: GqlContext,
  ref: GroupRef,
  notFoundMessage = GROUP_NOT_FOUND
): Promise<GroupAccess> {
  requireUser(ctx);
  const access = await findGroupAccess(ctx, ref);
  if (!access) throw new Error(notFoundMessage);
  return access;
}

/** Exige ser admin de ESTE grupo (serlo de otro no cuenta). */
export async function requireGroupAdmin(
  ctx: GqlContext,
  ref: GroupRef,
  notFoundMessage = GROUP_NOT_FOUND
): Promise<GroupAccess> {
  const access = await requireGroupAccess(ctx, ref, notFoundMessage);
  if (!access.isAdmin) throw new Error(NOT_GROUP_ADMIN);
  return access;
}
