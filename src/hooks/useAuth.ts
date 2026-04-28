"use client";
import { useState, useEffect } from "react";
import { buildKakaoLoginUrlWithReferral } from "@/lib/referral";

type User = { id: string; nickname: string; profileImage: string | null; referralCode?: string };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => setUser(data.loggedIn ? data.user : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (returnTo?: string | null) => {
    window.location.href = buildKakaoLoginUrlWithReferral(
      typeof returnTo === "string" ? returnTo : null
    );
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  return { user, loading, login, logout };
}
