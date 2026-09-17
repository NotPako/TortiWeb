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
  userKey: string; // normalizado — coincide con User.usernameKey y Vote.userKey
  userName: string; // denormalizado, igual que Vote/Comment
  /** Rol en ESTE grupo: se puede ser admin de una peña y miembro de otra. */
  role: GroupRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<MembershipDocument>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userKey: { type: String, required: true, trim: true, lowercase: true },
    userName: { type: String, required: true, trim: true },
    role: { type: String, enum: GROUP_ROLES, required: true, default: 'member' },
    joinedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

// Una sola membresía por persona y grupo; también sirve para "miembros de".
MembershipSchema.index({ group: 1, userKey: 1 }, { unique: true });
// "Mis grupos".
MembershipSchema.index({ userKey: 1 });

export const Membership: Model<MembershipDocument> =
  mongoose.models.Membership ||
  mongoose.model<MembershipDocument>('Membership', MembershipSchema);
