import mongoose, { Schema, Model, Document, Types } from 'mongoose';

export interface VoteDocument extends Document {
  tortilla: Types.ObjectId;
  userName: string;
  userKey: string; // nombre normalizado (lower-case, trim) para evitar duplicados
  score: number; // 0..10 con decimales
  createdAt: Date;
  updatedAt: Date;
}

const VoteSchema = new Schema<VoteDocument>(
  {
    tortilla: {
      type: Schema.Types.ObjectId,
      ref: 'Tortilla',
      required: true,
      index: true,
    },
    userName: { type: String, required: true, trim: true },
    userKey: { type: String, required: true, trim: true, lowercase: true },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      validate: {
        validator: (v: number) => Number.isFinite(v) && v >= 0 && v <= 10,
        message: 'La puntuación debe estar entre 0 y 10.',
      },
    },
  },
  { timestamps: true }
);

// Un voto por usuario y tortilla (se actualiza en lugar de duplicarse)
VoteSchema.index({ tortilla: 1, userKey: 1 }, { unique: true });

export const Vote: Model<VoteDocument> =
  mongoose.models.Vote || mongoose.model<VoteDocument>('Vote', VoteSchema);
