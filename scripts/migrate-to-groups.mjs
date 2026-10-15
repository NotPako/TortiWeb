/**
 * Migración a multi-grupo (0024): todo lo que existía pasa a un grupo por
 * defecto y cada usuario se convierte en miembro de ese grupo.
 *
 * Uso:
 *   node scripts/migrate-to-groups.mjs                       # dry-run: solo cuenta
 *   node scripts/migrate-to-groups.mjs --execute             # aplica los cambios
 *   node scripts/migrate-to-groups.mjs --execute --slug=pena --name="La Peña"
 *
 * Requisito: haber ejecutado antes `scripts/migrate-votes-to-user-id.mjs`
 * (0017). Si quedan votos sin vincular a una cuenta existente, avisa y para.
 *
 * Qué hace:
 *   1. Crea el grupo por defecto (o reutiliza el que tenga ese slug).
 *   2. Da membresía a cada usuario con nombre elegido: admin si `User.role`
 *      era "admin", miembro si no. Copia `User.seenAchievements` a la
 *      membresía (los logros vistos ahora son por grupo).
 *   3. Pone el grupo en tortillas, convocatorias, votos y comentarios que no
 *      lo tengan (votos y comentarios heredan el de su tortilla).
 *   4. Cambia los índices por los nuevos (con grupo).
 *   5. Verifica que no queda nada sin grupo.
 *
 * `User.role` y `User.seenAchievements` no se borran: la app ya no los lee,
 * y se pueden limpiar cuando la migración esté validada en producción.
 *
 * Credenciales: MONGODB_URI desde .env.local en la raíz del repo.
 * Es idempotente: conviene relanzarlo justo después de desplegar, por si
 * entró algo con la versión anterior entre medias.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUTE = process.argv.includes('--execute');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const SLUG = arg('slug', 'tortiweb').trim().toLowerCase();
const NAME = arg('name', 'TortiWeb').trim();

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
if (!/^[a-z0-9-]{1,40}$/.test(SLUG)) {
  console.error('--slug solo admite minúsculas, números y guiones (máx. 40).');
  process.exit(1);
}

/** Cuentas que aún no han elegido nombre (login con Google a medias). */
const isPlaceholder = (u) => typeof u.usernameKey === 'string' && u.usernameKey.startsWith('g_');

async function dropIndexIfExists(col, name) {
  const indexes = await col.indexes();
  if (indexes.some((i) => i.name === name)) await col.dropIndex(name);
}

async function main() {
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const col = (name) => db.collection(name);
  console.log(EXECUTE ? '== EJECUCIÓN ==' : '== DRY-RUN (añade --execute para aplicar) ==');
  console.log(`Grupo por defecto: "${NAME}" (/g/${SLUG})`);

  // 0. Requisito: 0017 aplicada.
  const users = await col('users').find({}).toArray();
  const keys = new Set(users.map((u) => u.usernameKey));
  const unlinked = await col('votes').countDocuments({
    user: { $exists: false },
    userKey: { $in: [...keys] },
  });
  if (unlinked > 0) {
    console.error(
      `Hay ${unlinked} votos de cuentas existentes sin vincular por id. ` +
        'Ejecuta antes: node scripts/migrate-votes-to-user-id.mjs --execute'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // 1. Grupo.
  let group = await col('groups').findOne({ slug: SLUG });
  const creator =
    users.find((u) => u.role === 'admin' && !isPlaceholder(u)) ??
    users.find((u) => !isPlaceholder(u));
  console.log(group ? 'El grupo ya existe: se reutiliza.' : 'Se creará el grupo.');
  if (!group && EXECUTE) {
    if (!creator) throw new Error('No hay ningún usuario con nombre para crear el grupo.');
    const now = new Date();
    const res = await col('groups').insertOne({
      name: NAME,
      slug: SLUG,
      createdBy: creator._id,
      createdAt: now,
      updatedAt: now,
    });
    group = { _id: res.insertedId };
  }
  const groupId = group?._id;

  // 2. Membresías.
  const real = users.filter((u) => !isPlaceholder(u));
  const existing = groupId
    ? new Set(
        (await col('memberships').find({ group: groupId }).toArray()).map((m) => String(m.user))
      )
    : new Set();
  const toAdd = real.filter((u) => !existing.has(String(u._id)));
  const admins = toAdd.filter((u) => u.role === 'admin');
  console.log(
    `Membresías: ${toAdd.length} nuevas (${admins.length} admins), ${existing.size} ya existían. ` +
      `Se omiten ${users.length - real.length} cuentas sin nombre elegido.`
  );
  if (real.length > 0 && !real.some((u) => u.role === 'admin') && existing.size === 0) {
    console.warn('Aviso: nadie tenía rol admin; el grupo se quedaría sin admins. El creador será admin.');
  }
  if (EXECUTE && toAdd.length) {
    const now = new Date();
    await col('memberships').insertMany(
      toAdd.map((u) => ({
        group: groupId,
        user: u._id,
        userName: u.username,
        role:
          u.role === 'admin' || (!real.some((r) => r.role === 'admin') && creator && u._id.equals(creator._id))
            ? 'admin'
            : 'member',
        joinedAt: u.createdAt ?? now,
        ...(Array.isArray(u.seenAchievements) ? { seenAchievements: u.seenAchievements } : {}),
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  // 3. Grupo en los datos.
  const noGroup = { group: { $exists: false } };
  const counts = {};
  for (const name of ['tortillas', 'tortillaevents', 'votes', 'comments']) {
    counts[name] = await col(name).countDocuments(noGroup);
  }
  console.log('Sin grupo:', counts);
  if (EXECUTE) {
    await col('tortillas').updateMany(noGroup, { $set: { group: groupId } });
    await col('tortillaevents').updateMany(noGroup, { $set: { group: groupId } });
    // Votos y comentarios heredan el grupo de su tortilla.
    const tortillas = await col('tortillas').find({}, { projection: { group: 1 } }).toArray();
    const byGroup = new Map();
    for (const t of tortillas) {
      const k = String(t.group);
      if (!byGroup.has(k)) byGroup.set(k, { group: t.group, ids: [] });
      byGroup.get(k).ids.push(t._id);
    }
    for (const { group: g, ids } of byGroup.values()) {
      for (const name of ['votes', 'comments']) {
        await col(name).updateMany({ ...noGroup, tortilla: { $in: ids } }, { $set: { group: g } });
      }
    }
  }

  // 4. Índices.
  if (EXECUTE) {
    await dropIndexIfExists(col('tortillas'), 'date_-1');
    await col('tortillas').createIndex({ group: 1, date: -1 });
    await dropIndexIfExists(col('tortillaevents'), 'closedAt_1_date_-1');
    await col('tortillaevents').createIndex({ group: 1, closedAt: 1, date: -1 });
    await col('votes').createIndex({ group: 1, user: 1 });
    await col('comments').createIndex({ group: 1, user: 1 });
    await col('memberships').createIndex({ group: 1, user: 1 }, { unique: true });
    await col('memberships').createIndex({ user: 1 });
    await col('groups').createIndex({ slug: 1 }, { unique: true });
    await col('groupinvites').createIndex({ code: 1 }, { unique: true });
    await col('groupinvites').createIndex({ group: 1 });
  }

  // 5. Verificación.
  if (EXECUTE) {
    const left = {};
    for (const name of ['tortillas', 'tortillaevents', 'votes', 'comments']) {
      left[name] = await col(name).countDocuments(noGroup);
    }
    const orphanVotes = left.votes + left.comments;
    console.log('Sin grupo tras migrar:', left);
    if (Object.values(left).some((n) => n > 0)) {
      console.error(
        orphanVotes > 0
          ? 'Quedan votos o comentarios sin grupo: su tortilla no existe (datos huérfanos).'
          : 'Queda algo sin grupo: revisa antes de dar por buena la migración.'
      );
      process.exitCode = 1;
    }
    const adminCount = await col('memberships').countDocuments({ group: groupId, role: 'admin' });
    console.log(`Admins del grupo: ${adminCount}`);
  }

  await mongoose.disconnect();
  console.log(EXECUTE ? 'Hecho.' : 'Nada modificado (dry-run).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
