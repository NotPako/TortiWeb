import mongoose, { Schema, Model, Document } from 'mongoose';

export interface UserDocument extends Document {
  username: string;
  usernameKey: string; // normalizado (lowercase, trim) — coincide con Vote.userKey
  email: string;
  emailKey: string; // normalizado para unicidad case-insensitive
  passwordHash?: string;
  googleId?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, trim: true },
    usernameKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    email: { type: String, required: true, trim: true },
    emailKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String },
    googleId: { type: String, sparse: true, index: true },
    image: { type: String },
  },
  { timestamps: true }
);

export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
