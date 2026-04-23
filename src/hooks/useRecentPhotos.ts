import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "recent_selfies_v1";
const MAX_PHOTOS = 3;

export function useRecentPhotos() {
  const [recentPhotos, setRecentPhotos] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecentPhotos(JSON.parse(raw) as string[]);
    } catch {}
  }, []);

  const savePhoto = useCallback((dataUrl: string) => {
    setRecentPhotos((prev) => {
      const next = [dataUrl, ...prev.filter((p) => p !== dataUrl)].slice(0, MAX_PHOTOS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { recentPhotos, savePhoto };
}
