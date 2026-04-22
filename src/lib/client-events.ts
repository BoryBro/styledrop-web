"use client";

export function trackClientEvent(
  eventType: string,
  metadata?: Record<string, unknown> | null,
) {
  return fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      metadata: metadata ?? null,
    }),
  }).catch(() => undefined);
}
