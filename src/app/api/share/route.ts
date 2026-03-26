import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { beforeBase64, afterBase64 } = await req.json();

    if (!beforeBase64 || !afterBase64) {
      return NextResponse.json({ error: 'Both original and result images are required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const shareId = Date.now().toString();
    const beforeBuffer = Buffer.from(beforeBase64, 'base64');
    const afterBuffer = Buffer.from(afterBase64, 'base64');

    const beforeFilename = `shared/${shareId}-before.jpg`;
    const afterFilename = `shared/${shareId}-after.jpg`;

    // Upload Before Image
    const { error: beforeError } = await supabase.storage
      .from('shared-images')
      .upload(beforeFilename, beforeBuffer, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

    if (beforeError) throw beforeError;

    // Upload After Image
    const { error: afterError } = await supabase.storage
      .from('shared-images')
      .upload(afterFilename, afterBuffer, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

    if (afterError) throw afterError;

    const { data: afterUrlData } = supabase.storage
      .from('shared-images')
      .getPublicUrl(afterFilename);

    return NextResponse.json({ id: shareId, url: afterUrlData.publicUrl });
  } catch (error) {
    console.error('Share API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
