import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { TortillaEvent, type TortillaEventDocument } from '@/models/TortillaEvent';
import { nextWednesday } from '@/lib/dates';
import {
  join as joinSpots,
  leave as leaveSpots,
  review as reviewSpots,
  validateCapacity,
} from '@/lib/eventSpots';
import { requireUser, type GqlContext } from './context';
import { requireGroupAccess, requireGroupAdmin } from './access';
import { eventPayload } from './payloads';
import { updateEventSpots } from './spots';

const EVENT_NOT_FOUND = 'Convocatoria no encontrada.';

async function findEventOrThrow(id: string): Promise<TortillaEventDocument> {
  if (!Types.ObjectId.isValid(id)) throw new Error('ID de convocatoria inválido.');
  const doc = await TortillaEvent.findById(id).exec();
  if (!doc) throw new Error(EVENT_NOT_FOUND);
  return doc;
}

export const eventQueries = {
  async upcomingTortilla(
    _: unknown,
    args: { groupSlug: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const { group, user, isAdmin } = await requireGroupAccess(ctx, {
      slug: args.groupSlug,
    });
    const doc = await TortillaEvent.findOne({ group: group._id, closedAt: null })
      .sort({ date: -1 })
      .exec();
    if (!doc) return null;
    return eventPayload(doc, user, isAdmin);
  },
};

export const eventMutations = {
  async announceTortilla(
    _: unknown,
    args: {
      input: {
        groupSlug: string;
        date?: string | Date | null;
        note?: string | null;
        capacity?: number | null;
      };
    },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const { group, user } = await requireGroupAdmin(ctx, {
      slug: args.input.groupSlug,
    });
    const capacity = validateCapacity(args.input.capacity);

    // Una convocatoria abierta a la vez, por grupo.
    const existing = await TortillaEvent.findOne({
      group: group._id,
      closedAt: null,
    }).exec();
    if (existing) {
      throw new Error('Ya hay una convocatoria abierta. Ciérrala antes de crear otra.');
    }

    const doc = await TortillaEvent.create({
      group: group._id,
      date: args.input.date ? new Date(args.input.date) : nextWednesday(),
      note: args.input.note?.trim() || undefined,
      capacity,
      attendees: [],
      requests: [],
      announcedByKey: user.key,
    });
    return eventPayload(doc, user, true);
  },

  async closeTortillaEvent(_: unknown, args: { id: string }, ctx: GqlContext) {
    await connectToDatabase();
    requireUser(ctx);
    const doc = await findEventOrThrow(args.id);
    const { user } = await requireGroupAdmin(ctx, { id: doc.group }, EVENT_NOT_FOUND);
    if (!doc.closedAt) {
      doc.closedAt = new Date();
      await doc.save();
    }
    return eventPayload(doc, user, true);
  },

  async setAttendance(
    _: unknown,
    args: { id: string; attending: boolean },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx, 'Debes iniciar sesión para apuntarte.');
    const event = await findEventOrThrow(args.id);
    const { user: viewer, isAdmin } = await requireGroupAccess(
      ctx,
      { id: event.group },
      EVENT_NOT_FOUND
    );

    // Apuntarse con la convocatoria llena deja una solicitud en cola;
    // desapuntarse (o retirar la solicitud) deja entrar a la siguiente.
    const doc = await updateEventSpots(event._id as Types.ObjectId, (state) => {
      const now = new Date();
      if (args.attending) {
        joinSpots(
          state,
          { user: viewer.id.toString(), userKey: viewer.key, userName: viewer.name },
          now
        );
      } else {
        leaveSpots(state, viewer.id.toString(), now);
      }
    });
    return eventPayload(doc, viewer, isAdmin);
  },

  async reviewSpotRequest(
    _: unknown,
    args: { eventId: string; userId: string; approve: boolean },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx);
    if (!Types.ObjectId.isValid(args.userId)) throw new Error('ID inválido.');
    const event = await findEventOrThrow(args.eventId);
    const { user } = await requireGroupAdmin(ctx, { id: event.group }, EVENT_NOT_FOUND);
    const doc = await updateEventSpots(event._id as Types.ObjectId, (state) => {
      reviewSpots(state, args.userId, args.approve, new Date());
    });
    return eventPayload(doc, user, true);
  },
};
