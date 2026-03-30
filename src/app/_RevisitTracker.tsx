"use client";
import { useEffect } from "react";

export function RevisitTracker() {
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (!data.loggedIn) return;
        if (sessionStorage.getItem("sd_revisit_sent")) return;
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "revisit" }),
        }).catch(() => {});
        sessionStorage.setItem("sd_revisit_sent", "1");
      })
      .catch(() => {});
  }, []);
  return null;
}
