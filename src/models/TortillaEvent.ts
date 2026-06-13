import mongoose, { Schema, Model, Document, Types } from 'mongoose';

/** Apuntado a una convocatoria. Denormaliza userName igual que Vote/Comment. */
export interface AttendeeSub {
  userKey: string; // normalizado (lower-case, trim) — coincide con User.usernameKey
  userName: string; // display name capturado al apuntarse
  joinedAt: Date;
}

/**
 * Convocatoria de la próxima tortilla: existe ANTES de cocinarse. La gente se
 * apunta para que el chef sepa cuántos ingredientes preparar. Cuando el admin
 * sube la tortilla cocinada (o la cierra a mano) la convocatoria se cierra.
 */
export interface TortillaEventDocument extends Document {
  date: Date; // el miércoles previsto
  note?: string; // mensaje opcional del admin ("traed pan", etc.)
  attendees: Types.DocumentArray<AttendeeSub & Types.Subdocument>;
  announcedByKey: string; // usernameKey del admin que convocó
  /** Si está definido, la convocatoria está cerrada (auto al subir tortilla o manual). */
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendeeSchema = new Schema<AttendeeSub>(
  {
    userKey: { type: String, required: true, trim: true, lowercase: true },
    userName: { type: String, required: true, trim: true },
    joinedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

const TortillaEventSchema = new Schema<TortillaEventDocument>(
  {
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    attendees: { type: [AttendeeSchema], default: [] },
    announcedByKey: { type: String, required: true, trim: true, lowercase: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// Soporta la consulta "convocatoria abierta": closedAt = null, más reciente.
TortillaEventSchema.index({ closedAt: 1, date: -1 });

export const TortillaEvent: Model<TortillaEventDocument> =
  mongoose.models.TortillaEvent ||
  mongoose.model<TortillaEventDocument>('TortillaEvent', TortillaEventSchema);
