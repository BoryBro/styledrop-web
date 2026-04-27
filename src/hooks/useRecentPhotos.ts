import { useState, useEffect, useCallback } from "react";

const RECENT_STORAGE_KEY = "recent_selfies_v1";
const PINNED_STORAGE_KEY = "pinned_selfies_v1";
const MAX_RECENT_PHOTOS = 6;
const MAX_PINNED_PHOTOS = 3;

function readPhotoList(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function persistPhotoList(key: string, photos: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(photos));
  } catch {}
}

export function useRecentPhotos() {
  const [recentPhotos, setRecentPhotos] = useState<string[]>([]);
  const [pinnedPhotos, setPinnedPhotos] = useState<string[]>([]);

  useEffect(() => {
    setRecentPhotos(readPhotoList(RECENT_STORAGE_KEY).slice(0, MAX_RECENT_PHOTOS));
    setPinnedPhotos(readPhotoList(PINNED_STORAGE_KEY).slice(0, MAX_PINNED_PHOTOS));
  }, []);

  const savePhoto = useCallback((dataUrl: string) => {
    setRecentPhotos((prev) => {
      const next = [dataUrl, ...prev.filter((p) => p !== dataUrl)].slice(0, MAX_RECENT_PHOTOS);
      persistPhotoList(RECENT_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const removePhoto = useCallback((dataUrl: string) => {
    setRecentPhotos((prev) => {
      const next = prev.filter((photo) => photo !== dataUrl);
      persistPhotoList(RECENT_STORAGE_KEY, next);
      return next;
    });
    setPinnedPhotos((prev) => {
      const next = prev.filter((photo) => photo !== dataUrl);
      persistPhotoList(PINNED_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const togglePinnedPhoto = useCallback((dataUrl: string) => {
    setPinnedPhotos((prev) => {
      const next = prev.includes(dataUrl)
        ? prev.filter((photo) => photo !== dataUrl)
        : [dataUrl, ...prev].slice(0, MAX_PINNED_PHOTOS);
      persistPhotoList(PINNED_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return {
    recentPhotos,
    pinnedPhotos,
    savePhoto,
    removePhoto,
    togglePinnedPhoto,
    maxPinnedPhotos: MAX_PINNED_PHOTOS,
  };
}
