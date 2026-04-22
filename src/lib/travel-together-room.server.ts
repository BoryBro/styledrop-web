import "server-only";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type TravelParticipantRole = "host" | "guest";
export type TravelRelation = "friend" | "lover" | "family" | "coworker";
export type TravelAnswerMap = Record<string, string | number>;

export type TravelRoomParticipant = {
  name: string;
  token: string;
  submitted: boolean;
  joinedAt: string | null;
  submittedAt: string | null;
  answers: TravelAnswerMap | null;
};

export type TravelRoomState = {
  roomId: string;
  relation: TravelRelation;
  host: TravelRoomParticipant;
  guest: TravelRoomParticipant;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TravelRoomView = {
  roomId: string;
  relation: TravelRelation;
  role: TravelParticipantRole;
  myName: string;
  partnerName: string;
  mySubmitted: boolean;
  partnerSubmitted: boolean;
  myAnswers: TravelAnswerMap | null;
  partnerAnswers: TravelAnswerMap | null;
  invitePath: string;
};

const ROOM_EVENT_TYPE = "lab_travel_room_state";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function randomId(size = 6) {
  return randomBytes(size).toString("hex").slice(0, size * 2);
}

function toTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mergeParticipantState(
  base: TravelRoomParticipant,
  next: TravelRoomParticipant,
): TravelRoomParticipant {
  const baseSubmittedAt = toTime(base.submittedAt);
  const nextSubmittedAt = toTime(next.submittedAt);
  const keepNextAnswers =
    next.answers &&
    (!base.answers || nextSubmittedAt >= baseSubmittedAt || baseSubmittedAt === 0);

  return {
    name: next.name || base.name,
    token: next.token || base.token,
    submitted: base.submitted || next.submitted,
    joinedAt:
      toTime(next.joinedAt) >= toTime(base.joinedAt)
        ? next.joinedAt ?? base.joinedAt
        : base.joinedAt,
    submittedAt:
      nextSubmittedAt >= baseSubmittedAt
        ? next.submittedAt ?? base.submittedAt
        : base.submittedAt,
    answers: keepNextAnswers ? next.answers : base.answers,
  };
}

function mergeTravelRoomSnapshots(snapshots: TravelRoomState[]) {
  const [first, ...rest] = snapshots;
  if (!first) return null;

  return rest.reduce<TravelRoomState>((merged, snapshot) => ({
    ...merged,
    relation: snapshot.relation || merged.relation,
    createdAt: toTime(snapshot.createdAt) < toTime(merged.createdAt) ? snapshot.createdAt : merged.createdAt,
    updatedAt: toTime(snapshot.updatedAt) >= toTime(merged.updatedAt) ? snapshot.updatedAt : merged.updatedAt,
    version: Math.max(merged.version, snapshot.version),
    host: mergeParticipantState(merged.host, snapshot.host),
    guest: mergeParticipantState(merged.guest, snapshot.guest),
  }), first);
}

export function buildTravelInvitePath(room: TravelRoomState) {
  return `/travel-together?room=${encodeURIComponent(room.roomId)}&token=${encodeURIComponent(room.guest.token)}`;
}

export function getTravelRole(room: TravelRoomState, token: string): TravelParticipantRole | null {
  if (token === room.host.token) return "host";
  if (token === room.guest.token) return "guest";
  return null;
}

export function buildTravelRoomView(room: TravelRoomState, role: TravelParticipantRole): TravelRoomView {
  const me = role === "host" ? room.host : room.guest;
  const partner = role === "host" ? room.guest : room.host;
  const canRevealPartnerAnswers = room.host.submitted && room.guest.submitted;

  return {
    roomId: room.roomId,
    relation: room.relation,
    role,
    myName: me.name,
    partnerName: partner.name,
    mySubmitted: me.submitted,
    partnerSubmitted: partner.submitted,
    myAnswers: me.answers,
    partnerAnswers: canRevealPartnerAnswers ? partner.answers : null,
    invitePath: buildTravelInvitePath(room),
  };
}

export async function getTravelRoom(roomId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", ROOM_EVENT_TYPE)
    .contains("metadata", { roomId })
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return { room: null, error: error.message };
  }

  const snapshots = (data ?? [])
    .map((entry) => entry.metadata as TravelRoomState | null)
    .filter((entry): entry is TravelRoomState => Boolean(entry));
  const room = mergeTravelRoomSnapshots(snapshots);
  if (!room) {
    return { room: null, error: "room not found" };
  }

  return { room, error: null };
}

export async function saveTravelRoom(room: TravelRoomState) {
  const supabase = getSupabase();
  const { error } = await supabase.from("user_events").insert({
    user_id: null,
    event_type: ROOM_EVENT_TYPE,
    metadata: room,
  });

  return { ok: !error, error: error?.message ?? null };
}

export async function createTravelRoom(input: {
  myName: string;
  partnerName: string;
  relation: TravelRelation;
}) {
  const now = new Date().toISOString();
  const room: TravelRoomState = {
    roomId: randomId(4),
    relation: input.relation,
    host: {
      name: input.myName,
      token: randomId(12),
      submitted: false,
      joinedAt: now,
      submittedAt: null,
      answers: null,
    },
    guest: {
      name: input.partnerName,
      token: randomId(12),
      submitted: false,
      joinedAt: null,
      submittedAt: null,
      answers: null,
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const saved = await saveTravelRoom(room);
  if (!saved.ok) {
    return { room: null, error: saved.error };
  }

  return { room, error: null };
}

export async function markTravelParticipantJoined(room: TravelRoomState, role: TravelParticipantRole) {
  const current = role === "host" ? room.host : room.guest;
  if (current.joinedAt) return { room, error: null };

  const nextRoom: TravelRoomState = {
    ...room,
    updatedAt: new Date().toISOString(),
    version: room.version + 1,
    [role]: {
      ...current,
      joinedAt: new Date().toISOString(),
    },
  };

  const saved = await saveTravelRoom(nextRoom);
  if (!saved.ok) {
    return { room, error: saved.error };
  }

  const refreshed = await getTravelRoom(nextRoom.roomId);
  return { room: refreshed.room ?? nextRoom, error: refreshed.error };
}

export async function submitTravelAnswers(input: {
  room: TravelRoomState;
  role: TravelParticipantRole;
  answers: TravelAnswerMap;
}) {
  const now = new Date().toISOString();
  const current = input.role === "host" ? input.room.host : input.room.guest;

  const nextRoom: TravelRoomState = {
    ...input.room,
    updatedAt: now,
    version: input.room.version + 1,
    [input.role]: {
      ...current,
      submitted: true,
      joinedAt: current.joinedAt ?? now,
      submittedAt: now,
      answers: input.answers,
    },
  };

  const saved = await saveTravelRoom(nextRoom);
  if (!saved.ok) {
    return { room: null, error: saved.error };
  }

  const refreshed = await getTravelRoom(nextRoom.roomId);
  return { room: refreshed.room ?? nextRoom, error: refreshed.error };
}
