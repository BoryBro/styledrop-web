import "server-only";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type TravelParticipantRole = "host" | "guest";
export type TravelRelation = "friend" | "lover" | "family" | "coworker";
export type TravelAnswerMap = Record<string, string | number>;

export type TravelRoomParticipant = {
  name: string;
  token: string;
  userId: string | null;
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
  unlockedAt: string | null;
  unlockedByUserId: string | null;
  unlockCreditsCost: number | null;
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
  partnerResultPath: string | null;
  unlocked: boolean;
};

export type TravelHistoryItem = {
  roomId: string;
  relation: TravelRelation;
  myName: string;
  partnerName: string;
  participantToken: string;
  completedAt: string;
  unlocked: boolean;
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
    userId: next.userId ?? base.userId ?? null,
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
    unlockedAt:
      toTime(snapshot.unlockedAt) >= toTime(merged.unlockedAt)
        ? snapshot.unlockedAt ?? merged.unlockedAt
        : merged.unlockedAt,
    unlockedByUserId:
      toTime(snapshot.unlockedAt) >= toTime(merged.unlockedAt)
        ? snapshot.unlockedByUserId ?? merged.unlockedByUserId
        : merged.unlockedByUserId,
    unlockCreditsCost:
      toTime(snapshot.unlockedAt) >= toTime(merged.unlockedAt)
        ? snapshot.unlockCreditsCost ?? merged.unlockCreditsCost
        : merged.unlockCreditsCost,
    host: mergeParticipantState(merged.host, snapshot.host),
    guest: mergeParticipantState(merged.guest, snapshot.guest),
  }), first);
}

export function buildTravelInvitePath(room: TravelRoomState) {
  return `/travel-together?room=${encodeURIComponent(room.roomId)}&token=${encodeURIComponent(room.guest.token)}`;
}

function buildTravelResultPath(room: TravelRoomState, role: TravelParticipantRole) {
  const token = role === "host" ? room.host.token : room.guest.token;
  return `/travel-together?room=${encodeURIComponent(room.roomId)}&token=${encodeURIComponent(token)}&view=result`;
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
    partnerResultPath: canRevealPartnerAnswers
      ? buildTravelResultPath(room, role === "host" ? "guest" : "host")
      : null,
    unlocked: Boolean(room.unlockedAt),
  };
}

export function isTravelRoomCompleted(room: TravelRoomState) {
  return room.host.submitted && room.guest.submitted;
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

export async function saveTravelRoom(room: TravelRoomState, actorUserId: string | null = null) {
  const supabase = getSupabase();
  const { error } = await supabase.from("user_events").insert({
    user_id: actorUserId,
    event_type: ROOM_EVENT_TYPE,
    metadata: room,
  });

  return { ok: !error, error: error?.message ?? null };
}

export async function createTravelRoom(input: {
  myName: string;
  partnerName: string;
  relation: TravelRelation;
}, hostUserId: string | null = null) {
  const now = new Date().toISOString();
  const room: TravelRoomState = {
    roomId: randomId(4),
    relation: input.relation,
    host: {
      name: input.myName,
      token: randomId(12),
      userId: hostUserId,
      submitted: false,
      joinedAt: now,
      submittedAt: null,
      answers: null,
    },
    guest: {
      name: input.partnerName,
      token: randomId(12),
      userId: null,
      submitted: false,
      joinedAt: null,
      submittedAt: null,
      answers: null,
    },
    unlockedAt: null,
    unlockedByUserId: null,
    unlockCreditsCost: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  const saved = await saveTravelRoom(room, hostUserId);
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

  const saved = await saveTravelRoom(nextRoom, current.userId);
  if (!saved.ok) {
    return { room, error: saved.error };
  }

  const refreshed = await getTravelRoom(nextRoom.roomId);
  return { room: refreshed.room ?? nextRoom, error: refreshed.error };
}

export async function attachTravelParticipantUserId(
  room: TravelRoomState,
  role: TravelParticipantRole,
  userId: string,
) {
  const current = role === "host" ? room.host : room.guest;
  if (current.userId === userId) {
    return { room, error: null };
  }

  if (current.userId && current.userId !== userId) {
    return { room, error: "이 참여 링크는 다른 계정에 연결되어 있습니다." };
  }

  const nextRoom: TravelRoomState = {
    ...room,
    updatedAt: new Date().toISOString(),
    version: room.version + 1,
    [role]: {
      ...current,
      userId,
    },
  };

  const saved = await saveTravelRoom(nextRoom, userId);
  if (!saved.ok) {
    return { room, error: saved.error };
  }

  const refreshed = await getTravelRoom(nextRoom.roomId);
  return { room: refreshed.room ?? nextRoom, error: refreshed.error };
}

export async function unlockTravelRoom(
  room: TravelRoomState,
  actorUserId: string,
  creditCost: number,
) {
  if (room.unlockedAt) {
    return { room, error: null };
  }

  const now = new Date().toISOString();
  const nextRoom: TravelRoomState = {
    ...room,
    unlockedAt: now,
    unlockedByUserId: actorUserId,
    unlockCreditsCost: creditCost,
    updatedAt: now,
    version: room.version + 1,
  };

  const saved = await saveTravelRoom(nextRoom, actorUserId);
  if (!saved.ok) {
    return { room: null, error: saved.error };
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

  const saved = await saveTravelRoom(nextRoom, current.userId);
  if (!saved.ok) {
    return { room: null, error: saved.error };
  }

  const refreshed = await getTravelRoom(nextRoom.roomId);
  return { room: refreshed.room ?? nextRoom, error: refreshed.error };
}

export async function listCompletedTravelRoomsForUser(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", ROOM_EVENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return { items: [] as TravelHistoryItem[], error: error.message };
  }

  const grouped = new Map<string, TravelRoomState[]>();
  for (const entry of data ?? []) {
    const snapshot = entry.metadata as TravelRoomState | null;
    if (!snapshot?.roomId) continue;
    grouped.set(snapshot.roomId, [...(grouped.get(snapshot.roomId) ?? []), snapshot]);
  }

  const items = [...grouped.values()]
    .map((snapshots) => mergeTravelRoomSnapshots([...snapshots].reverse()))
    .filter((room): room is TravelRoomState => Boolean(room))
    .filter((room) => isTravelRoomCompleted(room))
    .filter((room) => room.host.userId === userId || room.guest.userId === userId)
    .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))
    .map((room) => {
      const role: TravelParticipantRole = room.host.userId === userId ? "host" : "guest";
      const me = role === "host" ? room.host : room.guest;
      const partner = role === "host" ? room.guest : room.host;

      return {
        roomId: room.roomId,
        relation: room.relation,
        myName: me.name,
        partnerName: partner.name,
        participantToken: me.token,
        completedAt:
          toTime(room.host.submittedAt) >= toTime(room.guest.submittedAt)
            ? room.host.submittedAt ?? room.updatedAt
            : room.guest.submittedAt ?? room.updatedAt,
        unlocked: Boolean(room.unlockedAt),
      };
    });

  return { items, error: null };
}
