import mongoose, { Types } from 'mongoose';
import { TortillaEvent, type TortillaEventDocument } from '@/models/TortillaEvent';
import type { SpotsState } from '@/lib/eventSpots';

/** Plazas del documento como estado plano para `eventSpots`. */
export function spotsStateOf(doc: TortillaEventDocument): SpotsState {
  return {
    capacity: doc.capacity,
    attendees: doc.attendees.map((a) => ({
      // Apuntados anteriores a la migración por id: no coinciden con nadie.
      user: a.user?.toString() ?? '',
      userKey: a.userKey,
      userName: a.userName,
      joinedAt: a.joinedAt,
    })),
    requests: doc.requests.map((r) => ({
      user: r.user.toString(),
      userKey: r.userKey,
      userName: r.userName,
      requestedAt: r.requestedAt,
      status: r.status,
    })),
  };
}

function writeSpotsState(doc: TortillaEventDocument, state: SpotsState) {
  doc.set(
    'attendees',
    state.attendees.map((a) => ({
      user: a.user ? new Types.ObjectId(a.user) : undefined,
      userKey: a.userKey,
      userName: a.userName,
      joinedAt: a.joinedAt,
    }))
  );
  doc.set(
    'requests',
    state.requests.map((r) => ({
      user: new Types.ObjectId(r.user),
      userKey: r.userKey,
      userName: r.userName,
      requestedAt: r.requestedAt,
      status: r.status,
    }))
  );
}

/**
 * Carga la convocatoria, aplica un cambio de plazas y guarda. Si otra
 * petición guardó entre medias (dos personas a por la última plaza), el
 * esquema lanza VersionError y se repite con el estado nuevo.
 */
export async function updateEventSpots(
  id: Types.ObjectId | string,
  change: (state: SpotsState) => void
): Promise<TortillaEventDocument> {
  for (let attempt = 1; ; attempt++) {
    const doc = await TortillaEvent.findById(id).exec();
    if (!doc) throw new Error('Convocatoria no encontrada.');
    if (doc.closedAt) throw new Error('Esta convocatoria está cerrada.');
    const state = spotsStateOf(doc);
    change(state);
    writeSpotsState(doc, state);
    try {
      await doc.save();
      return doc;
    } catch (err) {
      if (err instanceof mongoose.Error.VersionError && attempt < 5) continue;
      throw err;
    }
  }
}
