import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { MAX_COMMENT_LENGTH } from '@/lib/comments';

export interface CommentDocument extends Document {
  tortilla: Types.ObjectId;
  group: Types.ObjectId; // redundante con la tortilla, igual que en Vote
  userKey: string; // normalizado (lower-case, trim) — coincide con User.usernameKey
  userName: string; // display name capturado en el momento de comentar
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

export const Comment: Model<CommentDocument> =
  mongoose.models.Comment ||
  mongoose.model<CommentDocument>('Comment', CommentSchema);
