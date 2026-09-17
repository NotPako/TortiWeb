import { Types } from 'mongoose';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { TortillaDocument } from '@/models/Tortilla';
import { getR2BucketName, getR2Client, publicUrlFor } from '@/lib/r2';

export function decodeBase64Image(base64: string): Buffer {
  const match = base64.match(/^data:[^;]+;base64,(.+)$/);
  const raw = match ? match[1] : base64;
  return Buffer.from(raw, 'base64');
}

export function inferExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
  };
  return map[contentType.toLowerCase()] ?? 'bin';
}

export function buildImageUrl(
  doc: Pick<TortillaDocument, '_id' | 'imageKey'>
): string {
  const direct = publicUrlFor(doc.imageKey);
  if (direct) return direct;
  return `/api/image/${(doc._id as Types.ObjectId).toString()}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Borra un objeto de R2 sin propagar errores: no son críticos. */
export async function deleteObjectQuietly(
  key: string,
  warning?: string
): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key })
    );
  } catch (err) {
    if (warning) console.warn(warning, err);
  }
}
