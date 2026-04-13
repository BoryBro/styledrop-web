import "server-only";

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return (
    request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown"
  );
}

function hashValue(value: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? "styledrop-anon-fallback";
  return createHmac("sha256", secret).update(value).digest("hex");
}

function estimateBase64Bytes(value: string) {
  const normalized = value.replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
  return Math.floor((normalized.length * 3) / 4);
}

async function checkAnonymousLimitWithRpc(throttleKey: string, limit: number) {
  const supabase = getSupabase();
  const rpcRes = await supabase.rpc("check_and_increment_usage", {
    p_user_id: throttleKey,
    p_limit: limit,
  });

  if (rpcRes.error) {
    return null;
  }

  return rpcRes.data === true;
}

async function checkAnonymousLimitWithEvents(throttleKey: string, scope: string, limit: number) {
  const supabase = getSupabase();
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const countRes = await supabase
    .from("user_events")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .eq("event_type", "anonymous_api_throttle")
    .gte("created_at", since)
    .contains("metadata", { scope, throttle_key: throttleKey });

  if (countRes.error) {
    throw countRes.error;
  }

  if ((countRes.count ?? 0) >= limit) {
    return false;
  }

  const insertRes = await supabase.from("user_events").insert({
    user_id: null,
    event_type: "anonymous_api_throttle",
    metadata: {
      scope,
      throttle_key: throttleKey,
    },
  });

  if (insertRes.error) {
    throw insertRes.error;
  }

  return true;
}

export async function enforceAnonymousDailyLimit(
  request: NextRequest,
  {
    scope,
    limit,
  }: {
    scope: string;
    limit: number;
  },
) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) ?? "unknown";
  const throttleKey = `anon:${scope}:${hashValue(`${clientIp}|${userAgent}`)}`;

  const rpcAllowed = await checkAnonymousLimitWithRpc(throttleKey, limit);
  if (rpcAllowed !== null) {
    return rpcAllowed;
  }

  return checkAnonymousLimitWithEvents(throttleKey, scope, limit);
}

export function assertRequestBodySize(request: NextRequest, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("업로드 용량이 너무 큽니다. 이미지 크기를 줄인 뒤 다시 시도해주세요.");
  }
}

export function assertBase64ImageSize(
  imageBase64: string,
  {
    label = "이미지",
    maxBytes = DEFAULT_MAX_IMAGE_BYTES,
  }: {
    label?: string;
    maxBytes?: number;
  } = {},
) {
  if (!imageBase64) {
    return;
  }

  if (estimateBase64Bytes(imageBase64) > maxBytes) {
    throw new Error(`${label} 용량이 너무 큽니다. 10MB 이하 이미지로 다시 시도해주세요.`);
  }
}
