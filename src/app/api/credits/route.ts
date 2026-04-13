import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { getAvailableCredits } from "@/lib/credits.server";

function parseSession(request: NextRequest): { id: string; nickname: string } | null {
  return readSessionFromRequest(request);
}

export async function GET(request: NextRequest) {
  const session = parseSession(request);
  if (!session) return NextResponse.json({ credits: 0 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const credits = await getAvailableCredits(supabase, session.id);
  return NextResponse.json({ credits });
}
