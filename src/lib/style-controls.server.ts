import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  AUDITION_CONTROL_ID,
  buildDefaultStyleControls,
  mergeStyleControls,
  resolveFeatureControlState,
  styleControlsToMap,
  type StyleControlRow,
  type StyleControlState,
} from "@/lib/style-controls";
import { AUDITION_ENABLED } from "@/lib/feature-flags";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "42P01" || maybe.message?.includes("admin_style_controls") === true;
}

export async function loadStyleControls(): Promise<StyleControlState[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("admin_style_controls")
      .select("style_id, is_visible, is_enabled, disabled_reason, updated_at");

    if (error) {
      if (isMissingTableError(error)) return buildDefaultStyleControls();
      throw error;
    }

    return mergeStyleControls((data ?? []) as StyleControlRow[]);
  } catch (error) {
    console.error("[style-controls] load error:", error);
    return buildDefaultStyleControls();
  }
}

export async function loadStyleControlMap() {
  const rows = await loadStyleControls();
  return styleControlsToMap(rows);
}

export async function loadAuditionFeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[AUDITION_CONTROL_ID], AUDITION_ENABLED);
}

export async function saveStyleControls(rows: StyleControlRow[]) {
  const supabase = getSupabase();
  const validIds = new Set(buildDefaultStyleControls().map((style) => style.style_id));

  const normalized = rows
    .filter((row) => validIds.has(row.style_id))
    .map((row) => ({
      style_id: row.style_id,
      is_visible: row.is_visible,
      is_enabled: row.is_enabled,
      disabled_reason: row.disabled_reason?.trim() || null,
      updated_at: new Date().toISOString(),
    }));

  const { error } = await supabase
    .from("admin_style_controls")
    .upsert(normalized, { onConflict: "style_id" });

  if (error) throw error;
}
