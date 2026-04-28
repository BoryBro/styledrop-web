import "server-only";

import { createClient } from "@supabase/supabase-js";

export const LAB_HISTORY_HIDDEN_EVENT_TYPE = "lab_history_hidden";

export type LabHistoryType = "audition" | "balance-100" | "nabo-predict" | "travel-together";

const LAB_HISTORY_TYPES = new Set<LabHistoryType>([
  "audition",
  "balance-100",
  "nabo-predict",
  "travel-together",
]);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export function isLabHistoryType(value: unknown): value is LabHistoryType {
  return typeof value === "string" && LAB_HISTORY_TYPES.has(value as LabHistoryType);
}

export function getLabHistoryKey(type: LabHistoryType, itemId: string) {
  return `${type}:${itemId}`;
}

function readMetadata(row: { metadata: unknown }) {
  return row.metadata && typeof row.metadata === "object"
    ? row.metadata as Record<string, unknown>
    : {};
}

export async function listHiddenLabHistoryKeys(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata")
    .eq("user_id", userId)
    .eq("event_type", LAB_HISTORY_HIDDEN_EVENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return { keys: new Set<string>(), error: error.message };
  }

  return {
    keys: new Set(
      (data ?? [])
        .map((row) => String(readMetadata(row).key ?? ""))
        .filter(Boolean),
    ),
    error: null,
  };
}

export async function hideLabHistoryItem(userId: string, type: LabHistoryType, itemId: string) {
  const supabase = getSupabase();
  const key = getLabHistoryKey(type, itemId);
  const { error } = await supabase.from("user_events").insert({
    user_id: userId,
    event_type: LAB_HISTORY_HIDDEN_EVENT_TYPE,
    metadata: {
      key,
      type,
      itemId,
      hiddenAt: new Date().toISOString(),
    },
  });

  return { ok: !error, error: error?.message ?? null, key };
}
