import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { publicUrlFor } from '@/lib/r2';

export interface UserDocument extends Document {
  username: string;
  usernameKey: string; // normalizado (lowercase, trim) — coincide con Vote.userKey
  email: string;
  emailKey: string; // normalizado para unicidad case-insensitive
  passwordHash?: string;
  googleId?: string;
  image?: string; // URL externa (Google) — fallback si no hay imageKey
  imageKey?: string; // Key en R2 de la foto de perfil subida por el usuario
  imageContentType?: string;
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
    imageKey: { type: String },
    imageContentType: { type: String },
  },
  { timestamps: true }
);

export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * URL pública de la foto de perfil. Prioriza la imagen subida por el usuario
 * (servida desde R2) sobre la externa (Google).
 */
export function userImageUrl(
  doc: Pick<UserDocument, '_id' | 'image' | 'imageKey'>
): string | null {
  if (doc.imageKey) {
    const direct = publicUrlFor(doc.imageKey);
    if (direct) return direct;
    return `/api/user-image/${(doc._id as Types.ObjectId).toString()}`;
  }
  return doc.image ?? null;
}

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
