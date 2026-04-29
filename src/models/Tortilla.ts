import mongoose, { Schema, Model, Document } from 'mongoose';

export interface TortillaDocument extends Document {
  name: string;
  description?: string;
  date: Date;
  /** Key del objeto en el bucket R2, p.ej. "tortillas/2026-04-29-uuid.jpg". */
  imageKey: string;
  imageContentType: string;
  createdAt: Date;
  updatedAt: Date;
}

const TortillaSchema = new Schema<TortillaDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true, default: () => new Date() },
    imageKey: { type: String, required: true },
    imageContentType: { type: String, required: true },
  },
  { timestamps: true }
);

TortillaSchema.index({ date: -1 });

export const Tortilla: Model<TortillaDocument> =
  mongoose.models.Tortilla ||
  mongoose.model<TortillaDocument>('Tortilla', TortillaSchema);
