import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import {
  createDuoRoomState,
  isDuoRoomState,
  normalizeDuoRoomState,
  type DuoParticipant,
  type DuoRoomState,
} from "@/lib/audition-duo";

type ShareRow = {
  id: string;
  result_json: unknown;
  created_at?: string | null;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createDuoRoomId() {
  return `duo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRoom(row: ShareRow | null | undefined) {
  if (!row || !isDuoRoomState(row.result_json)) return null;
  return normalizeDuoRoomState(row.result_json);
}

export async function getDuoRoomById(roomId: string, supabase = getSupabase()) {
  const res = await supabase
    .from("audition_shares")
    .select("id, result_json, created_at")
    .eq("id", roomId)
    .maybeSingle();

  if (res.error) return { room: null, error: res.error.message };
  return { room: normalizeRoom(res.data as ShareRow | null), error: null };
}

export async function insertDuoRoom(args: {
  host: Omit<DuoParticipant, "ready" | "readyAt" | "accessToken">;
  supabase?: SupabaseClient;
}) {
  const supabase = args.supabase ?? getSupabase();
  const roomId = createDuoRoomId();
  const room = createDuoRoomState({
    roomId,
    inviteCode: createInviteCode(),
    host: args.host,
  });

  const res = await supabase.from("audition_shares").insert({
    id: roomId,
    result_json: room,
    genres_json: { kind: "duo_room_meta", mode: room.mode },
    best_scene_idx: 0,
    user_photo_url: null,
    still_image_url: null,
  });

  if (res.error) return { room: null, error: res.error.message };
  return { room, error: null };
}

export async function updateDuoRoom(room: DuoRoomState, supabase = getSupabase()) {
  const res: PostgrestSingleResponse<ShareRow | null> = await supabase
    .from("audition_shares")
    .update({
      result_json: room,
      genres_json: { kind: "duo_room_meta", mode: room.mode, status: room.status },
    })
    .eq("id", room.roomId)
    .select("id, result_json, created_at")
    .maybeSingle();

  if (res.error) return { room: null, error: res.error.message };
  return { room: normalizeRoom(res.data), error: null };
}
