import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  createTestDuoGuestParticipant,
  createTestDuoGuestSubmission,
  createEmptyDuoSubmission,
  getDuoViewerRole,
  isTestDuoGuestUserId,
  toPublicDuoRoomState,
  withResolvedDuoRoomStatus,
  type DuoRoomState,
} from "@/lib/audition-duo";
import { pickRandomDuoBattleScene } from "@/lib/audition-duo-scenes";
import {
  createTemporaryDuoGuest,
  readValidatedDuoGuest,
  setDuoGuestCookie,
} from "@/lib/audition-duo-guest.server";
import { getDuoRoomById, updateDuoRoom } from "@/lib/audition-duo.server";
import { loadAuditionFeatureControl } from "@/lib/style-controls.server";

type RoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeRoom(room: DuoRoomState, viewerId: string | null | undefined) {
  return {
    room: toPublicDuoRoomState(room),
    viewerRole: getDuoViewerRole(room, viewerId),
  };
}

function resolveViewerId(request: NextRequest, room: DuoRoomState) {
  const session = readSessionFromRequest(request);
  if (session) {
    return {
      type: "session" as const,
      userId: session.id,
      nickname: session.nickname,
      profileImage: session.profileImage,
    };
  }

  const guest = readValidatedDuoGuest(request, room);
  if (guest) {
    return {
      type: "guest" as const,
      userId: guest.userId,
      nickname: guest.nickname,
      profileImage: null,
    };
  }

  return {
    type: "spectator" as const,
    userId: null,
    nickname: null,
    profileImage: null,
  };
}

export async function GET(request: NextRequest, { params }: RoomRouteContext) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) {
    return jsonError("AI 오디션이 현재 비공개 상태입니다.", 503);
  }

  const { roomId } = await params;
  const { room, error } = await getDuoRoomById(roomId);
  if (error) return jsonError(error, 500);
  if (!room) return jsonError("방을 찾지 못했습니다.", 404);

  const viewer = resolveViewerId(request, room);

  return NextResponse.json({
    ok: true,
    ...sanitizeRoom(room, viewer.userId),
  });
}

export async function POST(request: NextRequest, { params }: RoomRouteContext) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) {
    return jsonError("AI 오디션이 현재 비공개 상태입니다.", 503);
  }

  const { roomId } = await params;
  const supabase = getSupabase();
  const roomRes = await getDuoRoomById(roomId, supabase);

  if (roomRes.error) return jsonError(roomRes.error, 500);
  if (!roomRes.room) return jsonError("방을 찾지 못했습니다.", 404);

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const viewer = resolveViewerId(request, roomRes.room);
  const currentRole = getDuoViewerRole(roomRes.room, viewer.userId);
  const now = new Date().toISOString();
  let nextRoom = roomRes.room;
  let guestCookieToSet: ReturnType<typeof createTemporaryDuoGuest>["session"] | null = null;

  if (action === "join") {
    if (currentRole !== "spectator") {
      return NextResponse.json({ ok: true, ...sanitizeRoom(nextRoom, viewer.userId) });
    }
    if (nextRoom.guest) {
      return jsonError("이미 두 명이 모두 입장한 방입니다.", 409);
    }

    const participant = viewer.type === "session"
      ? {
          userId: viewer.userId!,
          nickname: viewer.nickname ?? "친구",
          profileImage: viewer.profileImage,
          joinedAt: now,
          ready: false,
          readyAt: null,
          accessToken: null,
        }
      : (() => {
          const temporaryGuest = createTemporaryDuoGuest(roomId, body.guestName, now);
          guestCookieToSet = temporaryGuest.session;
          return temporaryGuest.participant;
        })();

    nextRoom = withResolvedDuoRoomStatus({
      ...nextRoom,
      guest: participant,
      battle: {
        ...nextRoom.battle,
        guestSubmission: createEmptyDuoSubmission(participant.userId),
      },
    }, now);
  } else if (action === "set_ready") {
    if (currentRole === "spectator") return jsonError("참가자만 준비 상태를 바꿀 수 있습니다.", 403);
    const ready = Boolean(body.ready);
    if (currentRole === "host") {
      nextRoom = withResolvedDuoRoomStatus({
        ...nextRoom,
        host: {
          ...nextRoom.host,
          ready,
          readyAt: ready ? now : null,
        },
      }, now);
    } else {
      nextRoom = withResolvedDuoRoomStatus({
        ...nextRoom,
        guest: nextRoom.guest
          ? {
              ...nextRoom.guest,
              ready,
              readyAt: ready ? now : null,
            }
          : null,
      }, now);
    }
  } else if (action === "start") {
    if (currentRole !== "host") return jsonError("방장만 시작할 수 있습니다.", 403);
    if (!nextRoom.host.ready || !nextRoom.guest?.ready) {
      return jsonError("두 참가자가 모두 준비 완료해야 시작할 수 있습니다.", 409);
    }
    const scene = nextRoom.battle.scene ?? pickRandomDuoBattleScene();
    nextRoom = withResolvedDuoRoomStatus({
      ...nextRoom,
      startedAt: now,
      battle: {
        ...nextRoom.battle,
        scene,
        result: null,
      },
    }, now);
  } else if (action === "start_test") {
    if (currentRole !== "host") return jsonError("방장만 테스트 시작할 수 있습니다.", 403);
    if (nextRoom.guest && !isTestDuoGuestUserId(nextRoom.guest.userId)) {
      return jsonError("실제 친구가 입장한 방에서는 테스트 시작을 사용할 수 없습니다.", 409);
    }

    const scene = nextRoom.battle.scene ?? pickRandomDuoBattleScene();
    const guest = nextRoom.guest ?? createTestDuoGuestParticipant(now);
    const guestSubmission = createTestDuoGuestSubmission(guest.userId, scene, now);

    nextRoom = withResolvedDuoRoomStatus({
      ...nextRoom,
      host: {
        ...nextRoom.host,
        ready: true,
        readyAt: now,
      },
      guest: {
        ...guest,
        ready: true,
        readyAt: now,
      },
      startedAt: now,
      battle: {
        ...nextRoom.battle,
        scene,
        guestSubmission,
        result: null,
      },
    }, now);
  } else {
    return jsonError("지원하지 않는 작업입니다.", 400);
  }

  const updated = await updateDuoRoom(nextRoom, supabase);
  if (updated.error || !updated.room) {
    return jsonError(updated.error ?? "방 상태를 저장하지 못했습니다.", 500);
  }

  await supabase.from("user_events").insert({
    user_id: viewer.type === "session" ? viewer.userId : null,
    event_type: `audition_duo_${action}`,
    metadata: {
      room_id: updated.room.roomId,
      viewer_role: getDuoViewerRole(updated.room, viewer.userId),
      actor_type: viewer.type,
    },
  });

  const response = NextResponse.json({
    ok: true,
    ...sanitizeRoom(updated.room, viewer.userId ?? updated.room.guest?.userId ?? null),
  });

  if (guestCookieToSet) {
    setDuoGuestCookie(response, guestCookieToSet);
  }

  return response;
}
