import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { loadAuditionFeatureControl } from "@/lib/style-controls.server";
import { getLabHistoryCutoffIso } from "@/lib/lab-history-retention.server";

async function hasShare(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data } = await supabase
    .from("audition_shares")
    .select("id")
    .eq("id", id)
    .gte("created_at", getLabHistoryCutoffIso())
    .maybeSingle();

  return Boolean(data?.id);
}

export default async function AuditionSharePage({ params }: { params: Promise<{ id: string }> }) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) notFound();

  const { id } = await params;
  const exists = await hasShare(id);
  if (!exists) notFound();

  redirect(`/audition/result?history_share=${encodeURIComponent(id)}`);
}
