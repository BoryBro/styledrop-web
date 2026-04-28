import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  AUDITION_CONTROL_ID,
  BALANCE_100_CONTROL_ID,
  MAGAZINE_CONTROL_ID,
  NABO_CONTROL_ID,
  NABO_PREDICT_CONTROL_ID,
  PERSONAL_COLOR_CONTROL_ID,
  TRAVEL_TOGETHER_CONTROL_ID,
  buildDefaultStyleControls,
  mergeStyleControls,
  resolveFeatureControlState,
  styleControlsToMap,
  type StyleControlRow,
  type StyleControlState,
} from "@/lib/style-controls";
import {
  AUDITION_ENABLED,
  BALANCE_100_LAB_ENABLED,
  MAGAZINE_ENABLED,
  NABO_LAB_ENABLED,
  NABO_PREDICT_LAB_ENABLED,
  PERSONAL_COLOR_LAB_ENABLED,
  TRAVEL_TOGETHER_LAB_ENABLED,
} from "@/lib/feature-flags";

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

export async function loadPersonalColorFeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[PERSONAL_COLOR_CONTROL_ID], PERSONAL_COLOR_LAB_ENABLED);
}

export async function loadNaboFeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[NABO_CONTROL_ID], NABO_LAB_ENABLED);
}

export async function loadNaboPredictFeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[NABO_PREDICT_CONTROL_ID], NABO_PREDICT_LAB_ENABLED);
}

export async function loadTravelTogetherFeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[TRAVEL_TOGETHER_CONTROL_ID], TRAVEL_TOGETHER_LAB_ENABLED);
}

export async function loadBalance100FeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[BALANCE_100_CONTROL_ID], BALANCE_100_LAB_ENABLED);
}

export async function loadMagazineFeatureControl() {
  const controlMap = await loadStyleControlMap();
  return resolveFeatureControlState(controlMap[MAGAZINE_CONTROL_ID], MAGAZINE_ENABLED);
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
