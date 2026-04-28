import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { afterBase64 } = await req.json();

    if (!afterBase64) {
      return NextResponse.json({ error: 'Result image is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const shareId = Date.now().toString();
    const afterBuffer = Buffer.from(afterBase64, 'base64');

    const afterFilename = `shared/${shareId}-after.jpg`;

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
