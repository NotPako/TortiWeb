/**
 * Fase 2 de la migración de la temporada 25/26.
 * Lee migration/seed.json (generado por scripts/extract_season.py), sube las
 * imágenes a R2 e inserta tortillas + votos en MongoDB Atlas.
 *
 * Uso:
 *   node scripts/migrate-season.mjs            # dry-run: muestra el plan, no toca nada
 *   node scripts/migrate-season.mjs --execute  # sube imágenes e inserta en Atlas
 *
 * Credenciales: se leen de .env.local en la raíz del repo (MONGODB_URI, R2_*).
 * Es idempotente: las tortillas ya existentes (mismo nombre+fecha) se saltan,
 * y los votos se upsertean por (tortilla, userKey).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_PATH = resolve(ROOT, 'migration', 'seed.json');
const IMAGES_DIR = resolve(ROOT, 'migration', 'images');
const EXECUTE = process.argv.includes('--execute');

// --- .env.local ---
function loadEnvLocal() {
  const path = resolve(ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta la variable de entorno ${name} (ponla en .env.local).`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
  const tortillas = seed.tortillas;

  console.log(`Temporada: ${seed.season}`);
  console.log(`Tortillas en seed: ${tortillas.length}`);
  console.log(
    `Votos en seed: ${tortillas.reduce((s, t) => s + t.votes.length, 0)}`
  );
  console.log(`Modo: ${EXECUTE ? 'EXECUTE (escribe en Atlas y R2)' : 'dry-run'}`);
  console.log();

  if (!EXECUTE) {
    for (const t of tortillas) {
      console.log(
        `  ${t.date} | ${t.name} | ${t.votes.length} votos | img: ${t.image}`
      );
    }
    console.log('\nDry-run terminado. Ejecuta con --execute para subir.');
    return;
  }

  const MONGODB_URI = requireEnv('MONGODB_URI');
  const R2_ACCOUNT_ID = requireEnv('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY_ID = requireEnv('R2_ACCESS_KEY_ID');
  const R2_SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY');
  const R2_BUCKET_NAME = requireEnv('R2_BUCKET_NAME');

  const { default: mongoose } = await import('mongoose');
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  await mongoose.connect(MONGODB_URI);

  // Esquemas mínimos equivalentes a src/models (no se pueden importar .ts aquí).
  const TortillaModel =
    mongoose.models.Tortilla ||
    mongoose.model(
      'Tortilla',
      new mongoose.Schema(
        {
          name: String,
          description: String,
          date: Date,
          imageKey: String,
          imageContentType: String,
          closedAt: Date,
        },
        { timestamps: true }
      )
    );
  const VoteModel =
    mongoose.models.Vote ||
    mongoose.model(
      'Vote',
      new mongoose.Schema(
        {
          tortilla: mongoose.Schema.Types.ObjectId,
          userName: String,
          userKey: String,
          score: Number,
        },
        { timestamps: true }
      )
    );

  let created = 0;
  let skipped = 0;
  let votesUpserted = 0;

  for (const t of tortillas) {
    // Mediodía UTC: cae en el mismo día tanto en UTC como en Europe/Madrid.
    const date = new Date(`${t.date}T12:00:00Z`);

    const existing = await TortillaModel.findOne({
      name: t.name,
      date: {
        $gte: new Date(`${t.date}T00:00:00Z`),
        $lt: new Date(`${t.date}T23:59:59Z`),
      },
    });

    let tortillaId;
    if (existing) {
      tortillaId = existing._id;
      skipped++;
      console.log(`= ya existe: ${t.date} ${t.name}`);
    } else {
      const ext = extname(t.image).toLowerCase();
      const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
      const imageKey = `tortillas/${t.date}-${randomUUID()}${ext}`;
      const body = readFileSync(resolve(IMAGES_DIR, t.image));

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: imageKey,
          Body: body,
          ContentType: contentType,
        })
      );

      const doc = await TortillaModel.create({
        name: t.name,
        description: t.description ?? undefined,
        date,
        imageKey,
        imageContentType: contentType,
        closedAt: date, // votación cerrada: es histórico
      });
      tortillaId = doc._id;
      created++;
      console.log(`+ creada: ${t.date} ${t.name} (${imageKey})`);
    }

    if (t.votes.length > 0) {
      const ops = t.votes.map((v) => {
        const userKey = v.userName.trim().toLowerCase();
        return {
          updateOne: {
            filter: { tortilla: tortillaId, userKey },
            update: {
              $set: {
                tortilla: tortillaId,
                userName: v.userName.trim(),
                userKey,
                score: Math.round(v.score * 10) / 10,
              },
            },
            upsert: true,
          },
        };
      });
      const res = await VoteModel.bulkWrite(ops);
      votesUpserted += res.upsertedCount + res.modifiedCount;
    }
  }

  console.log();
  console.log(
    `Hecho. Tortillas creadas: ${created}, ya existentes: ${skipped}, votos upserteados: ${votesUpserted}.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
