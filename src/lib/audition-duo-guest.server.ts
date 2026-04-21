import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { decodeSignedState, encodeSignedState } from "@/lib/signed-state";
import type { DuoParticipant, DuoRoomState } from "@/lib/audition-duo";

export const DUO_GUEST_COOKIE = "sd_duo_guest";
const DUO_GUEST_TTL_SECONDS = 60 * 60 * 24;

type DuoGuestEnvelope = {
  v: 1;
  iat: number;
  exp: number;
  roomId: string;
  userId: string;
  accessToken: string;
  nickname: string;
};

export type DuoGuestSession = {
  roomId: string;
  userId: string;
  accessToken: string;
  nickname: string;
};

export function sanitizeDuoGuestNickname(value: unknown) {
  if (typeof value !== "string") return "초대 친구";
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 20);
  return normalized || "초대 친구";
}

function normalizeGuestEnvelope(payload: DuoGuestEnvelope | null): DuoGuestSession | null {
  if (!payload || payload.v !== 1) return null;
  if (!payload.roomId || !payload.userId || !payload.accessToken) return null;
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) return null;

  return {
    roomId: payload.roomId,
    userId: payload.userId,
    accessToken: payload.accessToken,
    nickname: sanitizeDuoGuestNickname(payload.nickname),
  };
}

export function createDuoGuestCookieValue(session: DuoGuestSession, ttlSeconds = DUO_GUEST_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);

  return encodeSignedState<DuoGuestEnvelope>({
    v: 1,
    iat: now,
    exp: now + ttlSeconds,
    roomId: session.roomId,
    userId: session.userId,
    accessToken: session.accessToken,
    nickname: session.nickname,
  });
}

export function parseDuoGuestCookie(value: string | null | undefined) {
  return normalizeGuestEnvelope(decodeSignedState<DuoGuestEnvelope>(value));
}

export function readDuoGuestFromRequest(request: NextRequest) {
  return parseDuoGuestCookie(request.cookies.get(DUO_GUEST_COOKIE)?.value);
}

export function setDuoGuestCookie(response: NextResponse, session: DuoGuestSession, ttlSeconds = DUO_GUEST_TTL_SECONDS) {
  response.cookies.set(DUO_GUEST_COOKIE, createDuoGuestCookieValue(session, ttlSeconds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    priority: "high",
    maxAge: ttlSeconds,
    path: "/",
  });
}

export function clearDuoGuestCookie(response: NextResponse) {
  response.cookies.set(DUO_GUEST_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    priority: "high",
    maxAge: 0,
    path: "/",
  });
}

export function readValidatedDuoGuest(request: NextRequest, room: DuoRoomState) {
  const guest = readDuoGuestFromRequest(request);
  if (!guest) return null;
  if (guest.roomId !== room.roomId) return null;
  if (!room.guest) return null;
  if (room.guest.userId !== guest.userId) return null;
  if (!room.guest.accessToken || room.guest.accessToken !== guest.accessToken) return null;
  return guest;
}

export function createTemporaryDuoGuest(roomId: string, nickname: string, now = new Date().toISOString()) {
  const userId = `duo_guest_${crypto.randomUUID()}`;
  const accessToken = crypto.randomUUID();
  const safeNickname = sanitizeDuoGuestNickname(nickname);

  const participant: DuoParticipant = {
    userId,
    nickname: safeNickname,
    profileImage: null,
    joinedAt: now,
    ready: false,
    readyAt: null,
    accessToken,
  };

  return {
    participant,
    session: {
      roomId,
      userId,
      accessToken,
      nickname: safeNickname,
    } satisfies DuoGuestSession,
  };
}
