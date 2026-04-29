import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla } from '@/models/Tortilla';
import { getR2BucketName, getR2Client } from '@/lib/r2';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!Types.ObjectId.isValid(params.id)) {
    return new NextResponse('ID inválido', { status: 400 });
  }

  await connectToDatabase();
  const doc = await Tortilla.findById(params.id)
    .select('imageKey imageContentType')
    .exec();

  if (!doc) {
    return new NextResponse('No encontrada', { status: 404 });
  }

  try {
    const obj = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: doc.imageKey,
      })
    );
    if (!obj.Body) {
      return new NextResponse('Sin contenido', { status: 502 });
    }
    const bytes = await obj.Body.transformToByteArray();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type':
          doc.imageContentType || obj.ContentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('Error obteniendo imagen de R2:', err);
    return new NextResponse('Error obteniendo imagen', { status: 500 });
  }
}
