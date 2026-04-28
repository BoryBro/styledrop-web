import "server-only";

import { createClient } from "@supabase/supabase-js";

export const LAB_HISTORY_RETENTION_DAYS = 30;
export const LAB_HISTORY_RETENTION_MS = LAB_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const LAB_HISTORY_EVENT_TYPES = [
  "lab_balance_session_state",
  "lab_balance_prediction_state",
  "lab_balance_started",
  "lab_balance_completed",
  "lab_balance_share_link_copy",
  "lab_travel_room_state",
  "lab_travel_room_created",
  "lab_travel_response_completed",
  "lab_travel_partner_ready",
  "lab_travel_unlock",
  "lab_nabo_room_created",
  "lab_nabo_response_completed",
  "lab_nabo_premium_access",
  "lab_nabo_share_kakao",
  "lab_nabo_predict_link_created",
  "lab_nabo_predict_result_completed",
  "lab_personal_color_completed",
  "lab_history_hidden",
] as const;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export function getLabHistoryCutoffIso(now = Date.now()) {
  return new Date(now - LAB_HISTORY_RETENTION_MS).toISOString();
}

export function isWithinLabHistoryRetention(value: string | number | null | undefined, now = Date.now()) {
  if (value === null || value === undefined) return false;
  const time = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(time) && time >= now - LAB_HISTORY_RETENTION_MS;
}

export async function cleanupExpiredLabHistoryRecords(now = Date.now()) {
  const supabase = getSupabase();
  const cutoffIso = getLabHistoryCutoffIso(now);

  const userEvents = await supabase
    .from("user_events")
    .delete()
    .in("event_type", [...LAB_HISTORY_EVENT_TYPES])
    .lt("created_at", cutoffIso);

  if (userEvents.error) {
    return { ok: false, cutoffIso, error: userEvents.error.message };
  }

  const auditionHistory = await supabase
    .from("audition_history")
    .delete()
    .lt("created_at", cutoffIso);

  if (auditionHistory.error) {
    return { ok: false, cutoffIso, error: auditionHistory.error.message };
  }

  const auditionShares = await supabase
    .from("audition_shares")
    .delete()
    .lt("created_at", cutoffIso);

  if (auditionShares.error) {
    return { ok: false, cutoffIso, error: auditionShares.error.message };
  }

  const naboRooms = await supabase
    .from("nabo_rooms")
    .delete()
    .lt("expires_at", new Date(now).toISOString());

  if (naboRooms.error) {
    return { ok: false, cutoffIso, error: naboRooms.error.message };
  }

  return { ok: true, cutoffIso, error: null };
}
