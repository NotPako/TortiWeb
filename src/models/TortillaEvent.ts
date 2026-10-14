import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { DEFAULT_EVENT_CAPACITY, MAX_EVENT_CAPACITY, MIN_EVENT_CAPACITY } from '@/lib/eventSpots';

/** Apuntado a una convocatoria. Denormaliza userName igual que Vote/Comment. */
export interface AttendeeSub {
  /** Quién se apuntó. Ausente solo en convocatorias previas a la migración. */
  user?: Types.ObjectId;
  userKey: string; // normalizado (lower-case, trim) — copia del nombre
  userName: string; // copia para mostrar; se actualiza si se renombra
  joinedAt: Date;
}

/**
 * Solicitud de plaza cuando la convocatoria está llena. Las pendientes forman
 * una cola por orden de llegada; las rechazadas se quedan para que esa persona
 * no pueda volver a pedir en esta convocatoria. Las aprobadas pasan a
 * `attendees` y desaparecen de aquí.
 */
export interface SpotRequestSub {
  user: Types.ObjectId;
  userKey: string;
  userName: string; // copia para mostrar; se actualiza si se renombra
  requestedAt: Date;
  status: 'pending' | 'rejected';
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
  /** Plazas. Al llenarse, quien quiera venir envía una solicitud. */
  capacity: number;
  requests: Types.DocumentArray<SpotRequestSub & Types.Subdocument>;
  announcedByKey: string; // usernameKey del admin que convocó
  /** Si está definido, la convocatoria está cerrada (auto al subir tortilla o manual). */
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendeeSchema = new Schema<AttendeeSub>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    userKey: { type: String, required: true, trim: true, lowercase: true },
    userName: { type: String, required: true, trim: true },
    joinedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

const SpotRequestSchema = new Schema<SpotRequestSub>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userKey: { type: String, required: true, trim: true, lowercase: true },
    userName: { type: String, required: true, trim: true },
    requestedAt: { type: Date, required: true, default: () => new Date() },
    status: { type: String, enum: ['pending', 'rejected'], required: true },
  },
  { _id: false }
);

const TortillaEventSchema = new Schema<TortillaEventDocument>(
  {
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    attendees: { type: [AttendeeSchema], default: [] },
    // Las convocatorias anteriores al tope no tienen el campo: Mongoose
    // aplica el default al leerlas.
    capacity: {
      type: Number,
      required: true,
      default: DEFAULT_EVENT_CAPACITY,
      min: MIN_EVENT_CAPACITY,
      max: MAX_EVENT_CAPACITY,
    },
    requests: { type: [SpotRequestSchema], default: [] },
    announcedByKey: { type: String, required: true, trim: true, lowercase: true },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
    // Dos personas pulsando a la vez por la última plaza: la segunda en
    // guardar recibe un VersionError y el resolver reintenta con lo nuevo.
    optimisticConcurrency: true,
  }
);

// Soporta la consulta "convocatoria abierta": closedAt = null, más reciente.
TortillaEventSchema.index({ closedAt: 1, date: -1 });

export const TortillaEvent: Model<TortillaEventDocument> =
  mongoose.models.TortillaEvent ||
  mongoose.model<TortillaEventDocument>('TortillaEvent', TortillaEventSchema);
