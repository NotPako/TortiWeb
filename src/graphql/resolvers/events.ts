import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { TortillaEvent, type TortillaEventDocument } from '@/models/TortillaEvent';
import { nextWednesday } from '@/lib/dates';
import { requireUser, type GqlContext } from './context';
import {
  requireGroupAccess,
  requireGroupAdmin,
  type GroupAccess,
} from './access';
import { eventPayload } from './payloads';

const EVENT_NOT_FOUND = 'Convocatoria no encontrada.';

async function findEventOrThrow(id: string): Promise<TortillaEventDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('ID de convocatoria inválido.');
  }
  const doc = await TortillaEvent.findById(id).exec();
  if (!doc) throw new Error(EVENT_NOT_FOUND);
  return doc;
}

function viewerOf(access: GroupAccess) {
  return { userKey: access.user.userKey, isAdmin: access.isAdmin };
}

export const eventQueries = {
  async upcomingTortilla(
    _: unknown,
    args: { groupSlug: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAccess(ctx, { slug: args.groupSlug });
    const doc = await TortillaEvent.findOne({
      group: access.group._id,
      closedAt: null,
    })
      .sort({ date: -1 })
      .exec();
    if (!doc) return null;
    return eventPayload(doc, viewerOf(access));
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
      };
    },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    const access = await requireGroupAdmin(ctx, {
      slug: args.input.groupSlug,
    });

    // Una convocatoria abierta a la vez **por grupo**.
    const existing = await TortillaEvent.findOne({
      group: access.group._id,
      closedAt: null,
    }).exec();
    if (existing) {
      throw new Error(
        'Ya hay una convocatoria abierta. Ciérrala antes de crear otra.'
      );
    }

    const date = args.input.date ? new Date(args.input.date) : nextWednesday();
    const note = args.input.note?.trim() || undefined;

    const doc = await TortillaEvent.create({
      group: access.group._id,
      date,
      note,
      attendees: [],
      announcedByKey: access.user.userKey,
    });

    return eventPayload(doc, viewerOf(access));
  },

  async closeTortillaEvent(
    _: unknown,
    args: { id: string },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx);
    const doc = await findEventOrThrow(args.id);
    const access = await requireGroupAdmin(
      ctx,
      { id: doc.group },
      EVENT_NOT_FOUND
    );
    if (!doc.closedAt) {
      doc.closedAt = new Date();
      await doc.save();
    }
    return eventPayload(doc, viewerOf(access));
  },

  async setAttendance(
    _: unknown,
    args: { id: string; attending: boolean },
    ctx: GqlContext
  ) {
    await connectToDatabase();
    requireUser(ctx, 'Debes iniciar sesión para apuntarte.');
    const doc = await findEventOrThrow(args.id);
    const access = await requireGroupAccess(
      ctx,
      { id: doc.group },
      EVENT_NOT_FOUND
    );
    if (doc.closedAt) {
      throw new Error('Esta convocatoria está cerrada.');
    }

    const { userKey, userName } = access.user;
    const idx = doc.attendees.findIndex((a) => a.userKey === userKey);

    if (args.attending && idx === -1) {
      doc.attendees.push({ userKey, userName, joinedAt: new Date() });
      await doc.save();
    } else if (!args.attending && idx !== -1) {
      doc.attendees.splice(idx, 1);
      await doc.save();
    }

    return eventPayload(doc, viewerOf(access));
  },
};
