import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type LockEntry = {
  expiresAt: number;
  token: string;
};

const DEFAULT_LOCK_MS = 3 * 60 * 1000;

function getSigningSecret() {
  return process.env.NEXTAUTH_SECRET ?? "styledrop-request-lock";
}

function getGlobalLocks() {
  const scope = globalThis as typeof globalThis & {
    __styledropRequestLocks?: Map<string, LockEntry>;
  };

  if (!scope.__styledropRequestLocks) {
    scope.__styledropRequestLocks = new Map<string, LockEntry>();
  }

  return scope.__styledropRequestLocks;
}

function cleanupExpiredLocks() {
  const now = Date.now();
  const locks = getGlobalLocks();

  for (const [key, entry] of locks.entries()) {
    if (entry.expiresAt <= now) {
      locks.delete(key);
    }
  }
}

function normalizePart(part: string | number | boolean | null | undefined) {
  if (part === null || part === undefined) return "";
  if (typeof part === "boolean") return part ? "1" : "0";
  return String(part);
}

export function fingerprintBase64Image(imageBase64: string) {
  const normalized = imageBase64.replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
  return `${normalized.length}:${normalized.slice(0, 128)}:${normalized.slice(-128)}`;
}

export function createRequestFingerprint(
  scope: string,
  parts: Array<string | number | boolean | null | undefined>,
) {
  const payload = [scope, ...parts.map(normalizePart)].join("|");
  const digest = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  return `${scope}:${digest.slice(0, 32)}`;
}

export function acquireEphemeralRequestLock(key: string, ttlMs = DEFAULT_LOCK_MS) {
  cleanupExpiredLocks();

  const now = Date.now();
  const locks = getGlobalLocks();
  const existing = locks.get(key);

  if (existing && existing.expiresAt > now) {
    return {
      acquired: false as const,
      release: () => {},
    };
  }

  const token = `${now}:${Math.random().toString(36).slice(2)}`;
  locks.set(key, {
    expiresAt: now + ttlMs,
    token,
  });

  return {
    acquired: true as const,
    release: () => {
      const current = locks.get(key);
      if (current?.token === token) {
        locks.delete(key);
      }
    },
  };
}

export async function hasActiveRequestEvent(
  supabase: SupabaseClient,
  {
    userId,
    requestKey,
    eventTypes,
    activeEventType,
    windowMs = DEFAULT_LOCK_MS,
  }: {
    userId: string;
    requestKey: string;
    eventTypes: string[];
    activeEventType: string;
    windowMs?: number;
  },
) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const res = await supabase
    .from("user_events")
    .select("event_type, created_at")
    .eq("user_id", userId)
    .in("event_type", eventTypes)
    .gte("created_at", since)
    .contains("metadata", { request_key: requestKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw res.error;
  }

  return res.data?.event_type === activeEventType;
}
