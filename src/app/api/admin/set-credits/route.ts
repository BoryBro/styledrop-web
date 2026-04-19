import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCreditsWithPolicy } from "@/lib/credits.server";

export async function POST(request: NextRequest) {
  const { password, userId, credits } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const result = await addCreditsWithPolicy(supabase, { userId, credits, sourceType: "manual" });

  if (!result.ok) {
    return NextResponse.json({ error: result.error?.message ?? "크레딧 추가 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userId, credits });
}
