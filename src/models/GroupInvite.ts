import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { INVITE_CODE_LENGTH } from '@/lib/invites';

/**
 * Invitación a un grupo. El código viaja en el enlace `/join/<code>` o se
 * dicta. Caducidad y usos son opcionales (null = sin límite). Revocar no borra
 * la invitación, para conservar el rastro.
 */
export interface GroupInviteDocument extends Document {
  group: Types.ObjectId;
  code: string;
  createdByKey: string;
  expiresAt: Date | null;
  maxUses: number | null;
  uses: number;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GroupInviteSchema = new Schema<GroupInviteDocument>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      minlength: INVITE_CODE_LENGTH,
      maxlength: INVITE_CODE_LENGTH,
      unique: true,
      index: true,
    },
    createdByKey: { type: String, required: true, trim: true, lowercase: true },
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, default: null, min: 1 },
    uses: { type: Number, required: true, default: 0, min: 0 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const GroupInvite: Model<GroupInviteDocument> =
  mongoose.models.GroupInvite ||
  mongoose.model<GroupInviteDocument>('GroupInvite', GroupInviteSchema);
