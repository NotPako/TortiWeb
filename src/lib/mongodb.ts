import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Falta la variable de entorno MONGODB_URI. Define MONGODB_URI en .env.local'
  );
}

/**
 * Cacheamos la conexión entre recargas en desarrollo para evitar
 * que Next.js abra una conexión nueva en cada hot-reload.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global._mongooseCache ?? { conn: null, promise: null };

if (!global._mongooseCache) {
  global._mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
