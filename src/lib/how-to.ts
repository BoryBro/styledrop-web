export type GuideStep = {
  number: string;
  label: string;
  title: string;
  description: string;
  detail?: string;
  image: string;
  imageAlt: string;
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    number: "1",
    label: "스타일 고르기",
    title: "원하는 분위기의 카드를\n선택해보세요.",
    description: "일반 카드와 옵션 카드 중에서 먼저 하나를 고르면 됩니다.",
    image: "/images/how-to/step-1.jpg",
    imageAlt: "스타일 카드 선택 화면",
  },
  {
    number: "2",
    label: "사진 올리기",
    title: "셀카나 앨범 사진을\n올려주세요.",
    description: "촬영 또는 사진 선택 중 편한 방식으로 바로 넣을 수 있어요.",
    detail: "정면을 바라보는 밝은 셀카일수록 결과가 자연스러워요.",
    image: "/images/how-to/step-2.jpg",
    imageAlt: "사진 업로드 화면",
  },
  {
    number: "3",
    label: "얼굴 맞추기",
    title: "프레임 안에서\n얼굴 위치를 맞춰주세요.",
    description: "확대, 축소, 이동으로 눈과 얼굴이 프레임 안에 자연스럽게 들어오면 됩니다.",
    image: "/images/how-to/step-3.jpg",
    imageAlt: "프레임 조정 화면",
  },
  {
    number: "4",
    label: "결과 저장하기",
    title: "생성이 끝나면\n저장하거나 공유하세요.",
    description: "결과를 보고 저장, 공유, 다시하기 중 원하는 흐름으로 이어가면 됩니다.",
    image: "/images/how-to/step-4.jpg",
    imageAlt: "결과 저장 화면",
  },
];

const HOW_TO_HIDDEN_KEY = "sd_how_to_hidden_v1";
const HOW_TO_SEEN_KEY = "sd_how_to_seen_v1";

function resolveHowToKey(userId: string | null): string {
  return `${HOW_TO_HIDDEN_KEY}:${userId ?? "guest"}`;
}

function resolveHowToSeenKey(userId: string | null): string {
  return `${HOW_TO_SEEN_KEY}:${userId ?? "guest"}`;
}

export function readHowToHiddenPreference(userId: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(resolveHowToKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function readHowToSeenPreference(userId: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(resolveHowToSeenKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeHowToSeenPreference(userId: string | null, seen: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = resolveHowToSeenKey(userId);
    if (seen) {
      localStorage.setItem(key, "1");
      return;
    }
    localStorage.removeItem(key);
  } catch {
    // localStorage 접근 실패는 무시
  }
}

export function writeHowToHiddenPreference(userId: string | null, hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = resolveHowToKey(userId);
    if (hidden) {
      localStorage.setItem(key, "1");
      return;
    }
    localStorage.removeItem(key);
  } catch {
    // localStorage 접근 실패는 무시
  }
}
