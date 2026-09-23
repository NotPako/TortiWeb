import mongoose, { Schema, Model, Document, Types } from 'mongoose';

export type Reaction = 'fire' | 'yummy' | 'meh' | 'cringe';

export const REACTIONS: Reaction[] = ['fire', 'yummy', 'meh', 'cringe'];

export interface VoteDocument extends Document {
  tortilla: Types.ObjectId;
  /**
   * Autor del voto. Es la referencia buena: el nombre puede cambiar, el id no.
   * Ausente en los votos históricos de gente que nunca tuvo cuenta.
   */
  user?: Types.ObjectId;
  userName: string; // copia para mostrar; se actualiza si el autor se renombra
  userKey: string; // nombre normalizado; única referencia de los votos sin cuenta
  score: number; // 0..10 con decimales
  reaction?: Reaction;
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
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
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
    reaction: {
      type: String,
      enum: REACTIONS,
      required: false,
    },
  },
  { timestamps: true }
);

// Un voto por persona y tortilla (se actualiza en lugar de duplicarse). Con
// cuenta manda el id: si alguien se renombra y otro coge su nombre antiguo,
// por nombre chocarían. Los votos sin cuenta se siguen acotando por nombre.
VoteSchema.index(
  { tortilla: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $exists: true } } }
);
// `user: null` en un índice parcial cubre también los documentos sin el campo,
// que es como están guardados los votos históricos. MongoDB no admite
// `$exists: false` en `partialFilterExpression`.
VoteSchema.index(
  { tortilla: 1, userKey: 1 },
  {
    unique: true,
    partialFilterExpression: { user: null },
    name: 'tortilla_1_userKey_1_legacy',
  }
);

export const Vote: Model<VoteDocument> =
  mongoose.models.Vote || mongoose.model<VoteDocument>('Vote', VoteSchema);
