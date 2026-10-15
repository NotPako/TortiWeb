import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { MAX_COMMENT_LENGTH } from '@/lib/comments';

export interface CommentDocument extends Document {
  tortilla: Types.ObjectId;
  /**
   * Redundante (la tortilla ya sabe su grupo), pero permite sacar lo de un
   * grupo sin resolver antes la lista de tortillas.
   */
  group: Types.ObjectId;
  /** Autor. Ausente solo en comentarios anteriores a la migración a ids. */
  user?: Types.ObjectId;
  userKey: string; // normalizado; copia del nombre del autor en su momento
  userName: string; // copia para mostrar; se actualiza si el autor se renombra
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<CommentDocument>(
  {
    tortilla: {
      type: Schema.Types.ObjectId,
      ref: 'Tortilla',
      required: true,
      index: true,
    },
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userKey: { type: String, required: true, trim: true, lowercase: true },
    userName: { type: String, required: true, trim: true },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: MAX_COMMENT_LENGTH,
    },
  },
  { timestamps: true }
);

CommentSchema.index({ tortilla: 1, createdAt: -1 });
CommentSchema.index({ group: 1, user: 1 });

export const Comment: Model<CommentDocument> =
  mongoose.models.Comment ||
  mongoose.model<CommentDocument>('Comment', CommentSchema);
