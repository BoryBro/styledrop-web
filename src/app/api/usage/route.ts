import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from("style_usage")
    .select("style_id");

  if (error || !data) {
    return NextResponse.json({ counts: {} });
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.style_id] = (counts[row.style_id] || 0) + 1;
  }

  return NextResponse.json({ counts });
}
