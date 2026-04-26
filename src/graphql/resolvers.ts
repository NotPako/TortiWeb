import { GraphQLScalarType, Kind } from 'graphql';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla, TortillaDocument } from '@/models/Tortilla';
import { Vote, VoteDocument } from '@/models/Vote';

const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Fecha en formato ISO 8601',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  },
});

function normalizeUserKey(name: string): string {
  return name.trim().toLowerCase();
}

function decodeBase64Image(base64: string): Buffer {
  // Acepta tanto "data:image/jpeg;base64,..." como solo el contenido base64.
  const match = base64.match(/^data:[^;]+;base64,(.+)$/);
  const raw = match ? match[1] : base64;
  return Buffer.from(raw, 'base64');
}

async function computeStats(tortillaId: Types.ObjectId) {
  const stats = await Vote.aggregate<{
    _id: Types.ObjectId;
    avg: number;
    count: number;
  }>([
    { $match: { tortilla: tortillaId } },
    {
      $group: {
        _id: '$tortilla',
        avg: { $avg: '$score' },
        count: { $sum: 1 },
      },
    },
  ]);

  const stat = stats[0];
  return {
    averageScore: stat ? Number(stat.avg.toFixed(2)) : null,
    voteCount: stat ? stat.count : 0,
  };
}

type TortillaContext = {
  userName?: string | null;
};

async function tortillaPayload(
  doc: TortillaDocument,
  ctx: TortillaContext = {}
) {
  const { averageScore, voteCount } = await computeStats(
    doc._id as Types.ObjectId
  );
  return {
    id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    description: doc.description ?? null,
    date: doc.date,
    imageUrl: `/api/image/${(doc._id as Types.ObjectId).toString()}`,
    averageScore,
    voteCount,
    _id: doc._id, // se usa internamente para resolvers anidados
    _ctxUserName: ctx.userName ?? null,
  };
}

type ResolvedTortilla = Awaited<ReturnType<typeof tortillaPayload>>;

export const resolvers = {
  Date: dateScalar,

  Query: {
    async tortillas(_: unknown, args: { userName?: string | null }) {
      await connectToDatabase();
      const docs = await Tortilla.find({}).sort({ date: -1 }).exec();
      return Promise.all(
        docs.map((d) => tortillaPayload(d, { userName: args.userName }))
      );
    },

    async tortilla(
      _: unknown,
      args: { id: string; userName?: string | null }
    ) {
      await connectToDatabase();
      if (!Types.ObjectId.isValid(args.id)) return null;
      const doc = await Tortilla.findById(args.id).exec();
      if (!doc) return null;
      return tortillaPayload(doc, { userName: args.userName });
    },

    async currentTortilla(
      _: unknown,
      args: { userName?: string | null }
    ) {
      await connectToDatabase();
      const doc = await Tortilla.findOne({}).sort({ date: -1 }).exec();
      if (!doc) return null;
      return tortillaPayload(doc, { userName: args.userName });
    },
  },

  Mutation: {
    async createTortilla(
      _: unknown,
      args: {
        input: {
          name: string;
          description?: string | null;
          imageBase64: string;
          imageContentType: string;
          date?: string | Date | null;
          adminPassword: string;
        };
      }
    ) {
      await connectToDatabase();
      const expected = process.env.ADMIN_PASSWORD;
      if (!expected) {
        throw new Error(
          'ADMIN_PASSWORD no está configurada en el servidor.'
        );
      }
      if (args.input.adminPassword !== expected) {
        throw new Error('Contraseña de admin incorrecta.');
      }

      const buffer = decodeBase64Image(args.input.imageBase64);
      if (buffer.length === 0) {
        throw new Error('La imagen está vacía o no es válida.');
      }
      if (buffer.length > 8 * 1024 * 1024) {
        throw new Error('La imagen no puede superar 8 MB.');
      }

      const doc = await Tortilla.create({
        name: args.input.name.trim(),
        description: args.input.description?.trim() || undefined,
        date: args.input.date ? new Date(args.input.date) : new Date(),
        imageData: buffer,
        imageContentType: args.input.imageContentType,
      });

      return tortillaPayload(doc);
    },

    async castVote(
      _: unknown,
      args: {
        input: { tortillaId: string; userName: string; score: number };
      }
    ) {
      await connectToDatabase();

      const { tortillaId, userName, score } = args.input;
      if (!userName.trim()) throw new Error('El nombre es obligatorio.');
      if (!Types.ObjectId.isValid(tortillaId)) {
        throw new Error('ID de tortilla inválido.');
      }
      if (
        typeof score !== 'number' ||
        Number.isNaN(score) ||
        score < 0 ||
        score > 10
      ) {
        throw new Error('La puntuación debe estar entre 0 y 10.');
      }

      const tortilla = await Tortilla.findById(tortillaId).exec();
      if (!tortilla) throw new Error('Tortilla no encontrada.');

      const userKey = normalizeUserKey(userName);
      const vote = await Vote.findOneAndUpdate(
        { tortilla: tortilla._id, userKey },
        {
          $set: {
            score: Math.round(score * 10) / 10, // 1 decimal
            userName: userName.trim(),
            userKey,
            tortilla: tortilla._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();

      return {
        id: (vote._id as Types.ObjectId).toString(),
        userName: vote.userName,
        score: vote.score,
        createdAt: vote.createdAt,
      };
    },
  },

  Tortilla: {
    async votes(parent: ResolvedTortilla) {
      await connectToDatabase();
      const docs = await Vote.find({ tortilla: parent._id })
        .sort({ createdAt: -1 })
        .exec();
      return docs.map((v: VoteDocument) => ({
        id: (v._id as Types.ObjectId).toString(),
        userName: v.userName,
        score: v.score,
        createdAt: v.createdAt,
      }));
    },

    async myVote(parent: ResolvedTortilla) {
      const userName = parent._ctxUserName;
      if (!userName) return null;
      await connectToDatabase();
      const userKey = normalizeUserKey(userName);
      const v = await Vote.findOne({
        tortilla: parent._id,
        userKey,
      }).exec();
      if (!v) return null;
      return {
        id: (v._id as Types.ObjectId).toString(),
        userName: v.userName,
        score: v.score,
        createdAt: v.createdAt,
      };
    },
  },
};
