import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Faltan variables de entorno R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.'
    );
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export function getR2BucketName(): string {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) {
    throw new Error('Falta la variable de entorno R2_BUCKET_NAME.');
  }
  return name;
}

/**
 * Si está definida, las imágenes se sirven directamente desde R2.dev o tu
 * dominio personalizado. Si no, se proxean a través de /api/image/[id].
 */
export function getR2PublicUrl(): string | null {
  const url = process.env.R2_PUBLIC_URL?.trim();
  return url || null;
}

/**
 * Devuelve la URL pública directa para una key, o null si no se ha configurado
 * acceso público en el bucket.
 */
export function publicUrlFor(key: string): string | null {
  const base = getR2PublicUrl();
  if (!base) return null;
  // Encodificamos cada segmento del path por separado para no romper "/".
  const encoded = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base.replace(/\/$/, '')}/${encoded}`;
}
