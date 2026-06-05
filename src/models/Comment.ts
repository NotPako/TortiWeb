import mongoose, { Schema, Model, Document, Types } from 'mongoose';

export interface CommentDocument extends Document {
  tortilla: Types.ObjectId;
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
    userKey: { type: String, required: true, trim: true, lowercase: true },
    userName: { type: String, required: true, trim: true },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

CommentSchema.index({ tortilla: 1, createdAt: -1 });

export const Comment: Model<CommentDocument> =
  mongoose.models.Comment ||
  mongoose.model<CommentDocument>('Comment', CommentSchema);
