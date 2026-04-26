import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { Tortilla } from '@/models/Tortilla';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!Types.ObjectId.isValid(params.id)) {
    return new NextResponse('ID inválido', { status: 400 });
  }

  await connectToDatabase();
  const doc = await Tortilla.findById(params.id)
    .select('imageData imageContentType')
    .exec();

  if (!doc) {
    return new NextResponse('No encontrada', { status: 404 });
  }

  // doc.imageData es un Buffer (Node). Lo convertimos en Uint8Array para
  // pasarlo al constructor de Response.
  const bytes = new Uint8Array(doc.imageData);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': doc.imageContentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
