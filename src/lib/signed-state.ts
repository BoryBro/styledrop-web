import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function getSigningSecret() {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required");
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSigningSecret()).update(payload).digest();
}

export function encodeSignedState<T>(payload: T) {
  const serialized = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(serialized).toString("base64url");

  return `${serialized}.${signature}`;
}

export function decodeSignedState<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  const [serialized, signature] = value.split(".");
  if (!serialized || !signature) return null;

  try {
    const expected = signPayload(serialized);
    const actual = Buffer.from(signature, "base64url");

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }

    return JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
