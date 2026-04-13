import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { decodeSignedState, encodeSignedState } from "@/lib/signed-state";

export const SESSION_COOKIE = "sd_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionEnvelope = {
  v: 1;
  iat: number;
  exp: number;
  id: string;
  nickname: string;
  profileImage: string | null;
};

export type AppSession = {
  id: string;
  nickname: string;
  profileImage: string | null;
};

function normalizeSession(payload: SessionEnvelope | null): AppSession | null {
  if (!payload || payload.v !== 1 || typeof payload.id !== "string" || !payload.id.trim()) {
    return null;
  }

  if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) {
    return null;
  }

  return {
    id: payload.id,
    nickname: typeof payload.nickname === "string" ? payload.nickname : "",
    profileImage: typeof payload.profileImage === "string" ? payload.profileImage : null,
  };
}

export function createSessionCookieValue(session: AppSession, ttlSeconds = SESSION_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);

  return encodeSignedState<SessionEnvelope>({
    v: 1,
    iat: now,
    exp: now + ttlSeconds,
    id: session.id,
    nickname: session.nickname,
    profileImage: session.profileImage,
  });
}

export function parseSessionCookie(value: string | null | undefined) {
  return normalizeSession(decodeSignedState<SessionEnvelope>(value));
}

export function readSessionFromRequest(request: NextRequest) {
  return parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(response: NextResponse, session: AppSession, ttlSeconds = SESSION_TTL_SECONDS) {
  response.cookies.set(SESSION_COOKIE, createSessionCookieValue(session, ttlSeconds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    priority: "high",
    maxAge: ttlSeconds,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    priority: "high",
    maxAge: 0,
    path: "/",
  });
}
