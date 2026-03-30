// 비회원 히스토리 - 브라우저 로컬스토리지에 임시 보관

const KEY = "sd_guest_history";
const MAX_ITEMS = 20;

export type GuestHistoryItem = {
  id: string;
  style_id: string;
  result_image_url: string; // base64 data URL (로컬)
  created_at: string;
};

export function getGuestHistory(): GuestHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GuestHistoryItem[];
  } catch {
    return [];
  }
}

export function addGuestHistoryItem(item: Omit<GuestHistoryItem, "id" | "created_at">): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getGuestHistory();
    const newItem: GuestHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    // 최신 순으로, 최대 MAX_ITEMS개 유지
    const updated = [newItem, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage 용량 초과 등의 에러 무시
  }
}

export function clearGuestHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
