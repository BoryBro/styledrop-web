import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const [{ data, error }, naboCountRes, travelCountRes, personalColorCountRes] = await Promise.all([
    supabase
      .from("style_usage")
      .select("style_id"),
    supabase
      .from("user_events")
      .select("event_type", { count: "exact", head: true })
      .eq("event_type", "lab_nabo_room_created"),
    supabase
      .from("user_events")
      .select("event_type", { count: "exact", head: true })
      .eq("event_type", "lab_travel_room_created"),
    supabase
      .from("user_events")
      .select("event_type", { count: "exact", head: true })
      .eq("event_type", "lab_personal_color_completed"),
  ]);

  if (error) {
    console.error("[usage] Supabase error:", error.message);
    return NextResponse.json({ counts: {}, error: error.message });
  }
  if (!data) {
    return NextResponse.json({ counts: {} });
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.style_id] = (counts[row.style_id] || 0) + 1;
  }

  if (naboCountRes.error) {
    console.error("[usage] nabo count error:", naboCountRes.error.message);
  } else {
    counts.nabo = naboCountRes.count ?? 0;
  }

  if (travelCountRes.error) {
    console.error("[usage] travel-together count error:", travelCountRes.error.message);
  } else {
    counts.travel_together = travelCountRes.count ?? 0;
  }

  if (personalColorCountRes.error) {
    console.error("[usage] personal color count error:", personalColorCountRes.error.message);
  } else {
    counts.personal_color = personalColorCountRes.count ?? 0;
  }

  return NextResponse.json({ counts });
}
