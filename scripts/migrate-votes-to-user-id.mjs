/**
 * Migración de la 0017: las referencias a personas pasan del nombre
 * (`userKey`) al id de la cuenta (`user`).
 *
 * Uso:
 *   node scripts/migrate-votes-to-user-id.mjs            # dry-run: solo cuenta
 *   node scripts/migrate-votes-to-user-id.mjs --execute  # aplica los cambios
 *
 * Qué hace:
 *   1. Rellena `user` en votos, comentarios y apuntados a convocatorias cuyo
 *      `userKey` coincide con una cuenta. Los que no tienen cuenta (votos
 *      históricos del Excel) se quedan solo con el nombre.
 *   2. Sustituye el índice único antiguo de votos `{tortilla, userKey}` por
 *      dos parciales: uno por id y otro por nombre para los votos sin cuenta.
 *
 * Credenciales: MONGODB_URI desde .env.local en la raíz del repo.
 * Es idempotente: se puede relanzar sin efectos.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUTE = process.argv.includes('--execute');

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

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI (ponla en .env.local).');
  process.exit(1);
}

async function main() {
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(EXECUTE ? '== EJECUCIÓN ==' : '== DRY-RUN (añade --execute para aplicar) ==');

  const users = await db.collection('users').find({}, { projection: { usernameKey: 1 } }).toArray();
  const idByKey = new Map(users.map((u) => [u.usernameKey, u._id]));
  console.log(`Cuentas: ${users.length}`);

  // 1. Votos y comentarios.
  for (const name of ['votes', 'comments']) {
    const col = db.collection(name);
    const orphans = await col
      .find({ user: { $exists: false } }, { projection: { userKey: 1 } })
      .toArray();
    const linkable = orphans.filter((d) => idByKey.has(d.userKey));
    console.log(
      `${name}: ${orphans.length} sin cuenta, ${linkable.length} se pueden vincular`
    );
    if (EXECUTE && linkable.length) {
      const keys = [...new Set(linkable.map((d) => d.userKey))];
      for (const key of keys) {
        await col.updateMany(
          { userKey: key, user: { $exists: false } },
          { $set: { user: idByKey.get(key) } }
        );
      }
    }
  }

  // Apuntados a convocatorias.
  const events = await db.collection('tortillaevents').find({}).toArray();
  let attendeesLinked = 0;
  for (const ev of events) {
    let changed = false;
    const attendees = (ev.attendees ?? []).map((a) => {
      if (a.user || !idByKey.has(a.userKey)) return a;
      changed = true;
      attendeesLinked += 1;
      return { ...a, user: idByKey.get(a.userKey) };
    });
    if (EXECUTE && changed) {
      await db.collection('tortillaevents').updateOne({ _id: ev._id }, { $set: { attendees } });
    }
  }
  console.log(`apuntados: ${attendeesLinked} se pueden vincular`);

  // 2. Índices de votos.
  const votes = db.collection('votes');
  const indexes = await votes.indexes();
  const old = indexes.find(
    (i) => i.name === 'tortilla_1_userKey_1' && !i.partialFilterExpression
  );
  console.log(`Índice antiguo {tortilla, userKey}: ${old ? 'presente, se sustituye' : 'ya no está'}`);
  if (EXECUTE) {
    if (old) await votes.dropIndex('tortilla_1_userKey_1');
    await votes.createIndex(
      { tortilla: 1, user: 1 },
      { unique: true, partialFilterExpression: { user: { $exists: true } } }
    );
    // MongoDB no admite `$exists: false` en un índice parcial; `user: null`
    // cubre también los documentos sin el campo.
    await votes.createIndex(
      { tortilla: 1, userKey: 1 },
      { unique: true, partialFilterExpression: { user: null } }
    );
  }

  await mongoose.disconnect();
  console.log(EXECUTE ? 'Hecho.' : 'Nada modificado (dry-run).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
