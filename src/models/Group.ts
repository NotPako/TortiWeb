import mongoose, { Schema, Model, Document } from 'mongoose';
import {
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_SLUG_LENGTH,
} from '@/lib/groups';

/**
 * Grupo (peña): contenedor aislado de tortillas, votos, comentarios y
 * convocatorias. Quién pertenece y con qué rol vive en `Membership`.
 *
 * Se llama `Group` y no `Event` porque `TortillaEvent` ya significa
 * "convocatoria".
 */
export interface GroupDocument extends Document {
  name: string;
  /** Único; va en la URL (`/g/<slug>`). No cambia al renombrar el grupo. */
  slug: string;
  description?: string;
  createdByKey: string; // usernameKey de quien lo creó
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<GroupDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_GROUP_NAME_LENGTH,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: MAX_SLUG_LENGTH,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: MAX_GROUP_DESCRIPTION_LENGTH,
    },
    createdByKey: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

export const Group: Model<GroupDocument> =
  mongoose.models.Group || mongoose.model<GroupDocument>('Group', GroupSchema);
