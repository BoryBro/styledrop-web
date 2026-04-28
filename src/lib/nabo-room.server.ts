import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type NaboAnswerMap = Record<string, string | number>;

export type NaboRoomRow = {
  id: string;
  room_code: string;
  owner_user_id: string | null;
  owner_name: string;
  owner_token_hash: string;
  respondent_token: string;
  respondent_token_hash: string;
  response_target: number;
  result_available_after: string;
  premium_access_at: string | null;
  premium_access_by_user_id: string | null;
  premium_access_credits_cost: number | null;
  status: "open" | "closed" | "deleted";
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type NaboResponseRow = {
  id: string;
  room_id: string;
  answers: NaboAnswerMap;
  client_fingerprint_hash: string | null;
  created_at: string;
};

export type NaboRoomBundle = {
  room: NaboRoomRow;
  responses: NaboResponseRow[];
};

export type NaboViewerRole = "owner" | "respondent";

export type NaboRoomView = {
  roomCode: string;
  role: NaboViewerRole;
  ownerName: string;
  responseCount: number;
  responseTarget: number;
  resultAvailableAfter: string;
  canViewResults: boolean;
  premiumAccess: boolean;
  invitePath: string | null;
  ownerPath: string | null;
};

export const NABO_BASIC_RESULT_COUNT = 3;
export const NABO_FULL_RESULT_COUNT = 5;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function randomCode(bytes = 4) {
  return randomBytes(bytes).toString("hex");
}

export function createNaboToken() {
  return randomBytes(24).toString("base64url");
}

export function hashNaboToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildNaboOwnerPath(roomCode: string, ownerToken: string) {
  return `/nabo?room=${encodeURIComponent(roomCode)}&owner=${encodeURIComponent(ownerToken)}`;
}

export function buildNaboInvitePath(roomCode: string, respondentToken: string) {
  return `/nabo?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(respondentToken)}`;
}

export function verifyNaboOwnerToken(room: NaboRoomRow, token: string) {
  return hashNaboToken(token) === room.owner_token_hash;
}

export function verifyNaboRespondentToken(room: NaboRoomRow, token: string) {
  return hashNaboToken(token) === room.respondent_token_hash;
}

export function buildNaboRoomView(args: {
  bundle: NaboRoomBundle;
  role: NaboViewerRole;
  ownerToken?: string | null;
  respondentToken?: string | null;
}): NaboRoomView {
  const { room, responses } = args.bundle;
  const responseCount = responses.length;
  const resultAvailableTime = new Date(room.result_available_after).getTime();
  const canViewResults =
    responseCount >= NABO_BASIC_RESULT_COUNT &&
    Number.isFinite(resultAvailableTime) &&
    resultAvailableTime <= Date.now();

  return {
    roomCode: room.room_code,
    role: args.role,
    ownerName: room.owner_name,
    responseCount,
    responseTarget: room.response_target,
    resultAvailableAfter: room.result_available_after,
    canViewResults,
    premiumAccess: Boolean(room.premium_access_at),
    invitePath:
      args.role === "owner"
        ? buildNaboInvitePath(room.room_code, args.respondentToken ?? room.respondent_token)
        : null,
    ownerPath:
      args.role === "owner" && args.ownerToken
        ? buildNaboOwnerPath(room.room_code, args.ownerToken)
        : null,
  };
}

export async function createNaboRoom(input: {
  ownerName: string;
  ownerUserId?: string | null;
  responseTarget?: number;
}, supabase: SupabaseClient = getSupabase()) {
  const ownerToken = createNaboToken();
  const respondentToken = createNaboToken();
  const responseTarget = Math.min(20, Math.max(1, input.responseTarget ?? 5));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const roomCode = randomCode(4);
    const { data, error } = await supabase
      .from("nabo_rooms")
      .insert({
        room_code: roomCode,
        owner_user_id: input.ownerUserId ?? null,
        owner_name: input.ownerName,
        owner_token_hash: hashNaboToken(ownerToken),
        respondent_token: respondentToken,
        respondent_token_hash: hashNaboToken(respondentToken),
        response_target: responseTarget,
      })
      .select("*")
      .single();

    if (!error && data) {
      const room = data as NaboRoomRow;
      return {
        room,
        ownerToken,
        respondentToken,
        ownerPath: buildNaboOwnerPath(room.room_code, ownerToken),
        invitePath: buildNaboInvitePath(room.room_code, respondentToken),
        error: null,
      };
    }

    if (error?.code !== "23505") {
      return {
        room: null,
        ownerToken: null,
        respondentToken: null,
        ownerPath: null,
        invitePath: null,
        error: error?.message ?? "방 생성에 실패했습니다.",
      };
    }
  }

  return {
    room: null,
    ownerToken: null,
    respondentToken: null,
    ownerPath: null,
    invitePath: null,
    error: "방 코드 생성에 실패했습니다.",
  };
}

export async function getNaboRoomBundleByCode(
  roomCode: string,
  supabase: SupabaseClient = getSupabase(),
): Promise<{ bundle: NaboRoomBundle | null; error: string | null }> {
  const { data: room, error: roomError } = await supabase
    .from("nabo_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .neq("status", "deleted")
    .maybeSingle();

  if (roomError) return { bundle: null, error: roomError.message };
  if (!room) return { bundle: null, error: "방을 찾을 수 없습니다." };

  const { data: responses, error: responsesError } = await supabase
    .from("nabo_responses")
    .select("*")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true });

  if (responsesError) return { bundle: null, error: responsesError.message };

  return {
    bundle: {
      room: room as NaboRoomRow,
      responses: (responses ?? []) as NaboResponseRow[],
    },
    error: null,
  };
}

export async function submitNaboResponse(input: {
  roomCode: string;
  respondentToken: string;
  answers: NaboAnswerMap;
  respondentUserId?: string | null;
  clientFingerprint?: string | null;
}, supabase: SupabaseClient = getSupabase()): Promise<{
  bundle: NaboRoomBundle | null;
  duplicate: boolean;
  error: string | null;
}> {
  const { bundle, error } = await getNaboRoomBundleByCode(input.roomCode, supabase);

  if (error || !bundle) {
    return { bundle: null, duplicate: false, error: error ?? "방을 찾을 수 없습니다." };
  }

  if (bundle.room.status !== "open") {
    return { bundle: null, duplicate: false, error: "현재 응답을 받을 수 없는 방입니다." };
  }

  if (new Date(bundle.room.expires_at).getTime() <= Date.now()) {
    return { bundle: null, duplicate: false, error: "응답 기간이 지난 방입니다." };
  }

  if (!verifyNaboRespondentToken(bundle.room, input.respondentToken)) {
    return { bundle: null, duplicate: false, error: "응답 권한이 없습니다." };
  }

  if (input.respondentUserId && bundle.room.owner_user_id === input.respondentUserId) {
    return { bundle: null, duplicate: false, error: "방을 만든 계정으로는 응답할 수 없습니다." };
  }

  const duplicateKey = input.respondentUserId ?? input.clientFingerprint;
  const clientFingerprintHash = duplicateKey
    ? hashNaboToken(duplicateKey)
    : null;

  const { error: insertError } = await supabase
    .from("nabo_responses")
    .insert({
      room_id: bundle.room.id,
      answers: input.answers,
      client_fingerprint_hash: clientFingerprintHash,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { bundle, duplicate: true, error: "이미 제출한 응답입니다." };
    }

    return {
      bundle: null,
      duplicate: false,
      error: insertError.message ?? "응답 저장에 실패했습니다.",
    };
  }

  const refreshed = await getNaboRoomBundleByCode(input.roomCode, supabase);
  return {
    bundle: refreshed.bundle,
    duplicate: false,
    error: refreshed.error,
  };
}

export async function grantNaboPremiumAccess(input: {
  room: NaboRoomRow;
  actorUserId: string;
  creditCost: number;
}, supabase: SupabaseClient = getSupabase()): Promise<{
  room: NaboRoomRow | null;
  error: string | null;
  updated: boolean;
}> {
  if (input.room.premium_access_at) {
    return { room: input.room, error: null, updated: false };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("nabo_rooms")
    .update({
      premium_access_at: now,
      premium_access_by_user_id: input.actorUserId,
      premium_access_credits_cost: input.creditCost,
    })
    .eq("id", input.room.id)
    .is("premium_access_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      room: null,
      error: error?.message ?? "전체 결과 처리에 실패했습니다.",
      updated: false,
    };
  }

  if (data) {
    return { room: data as NaboRoomRow, error: null, updated: true };
  }

  const current = await supabase
    .from("nabo_rooms")
    .select("*")
    .eq("id", input.room.id)
    .maybeSingle();

  if (current.error || !current.data) {
    return {
      room: null,
      error: current.error?.message ?? "전체 결과 처리에 실패했습니다.",
      updated: false,
    };
  }

  return { room: current.data as NaboRoomRow, error: null, updated: false };
}
