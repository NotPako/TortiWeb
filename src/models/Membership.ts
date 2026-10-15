import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { GROUP_ROLES, type GroupRole } from '@/lib/groups';

/**
 * Pertenencia de un usuario a un grupo, con su rol en ese grupo.
 *
 * Colección aparte y no array dentro de `Group`: "mis grupos" se consulta
 * tanto como "miembros del grupo", y con un array embebido la primera obliga a
 * recorrer todos los grupos.
 */
export interface MembershipDocument extends Document {
  group: Types.ObjectId;
  /** La cuenta. Renombrarse no cambia a qué grupos perteneces. */
  user: Types.ObjectId;
  userName: string; // copia para mostrar; se actualiza al renombrarse
  /** Rol en ESTE grupo: se puede ser admin de una peña y miembro de otra. */
  role: GroupRole;
  joinedAt: Date;
  /**
   * Logros de este grupo cuyo aviso ya se mostró. Los logros son por grupo,
   * así que lo visto también. `undefined` = aún sin línea base: la primera
   * consulta marca como vistos los que ya tuviera, sin celebrarlos.
   */
  seenAchievements?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<MembershipDocument>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    role: { type: String, enum: GROUP_ROLES, required: true, default: 'member' },
    joinedAt: { type: Date, required: true, default: () => new Date() },
    // Sin default: Mongoose pondría [] y no distinguiríamos "sin línea base".
    seenAchievements: { type: [String], default: undefined },
  },
  { timestamps: true }
);

// Una sola membresía por persona y grupo; también sirve para "miembros de".
MembershipSchema.index({ group: 1, user: 1 }, { unique: true });
// "Mis grupos".
MembershipSchema.index({ user: 1 });

export const Membership: Model<MembershipDocument> =
  mongoose.models.Membership ||
  mongoose.model<MembershipDocument>('Membership', MembershipSchema);
