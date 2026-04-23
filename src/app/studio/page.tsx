"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const ANON_WORDS = [
  "코코", "루나", "민트", "하루", "별빛", "구름", "봄비", "달빛", "숲속", "노을",
  "파도", "새벽", "은하", "꽃잎", "체리", "바람", "이슬", "솔잎", "안개", "초록",
  "하늘", "강물", "햇살", "모래", "보랏", "연두", "산들", "반짝", "아침", "나비",
];

function anonName(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return ANON_WORDS[hash % ANON_WORDS.length];
}

function showcaseDisplayName(item: { instagramHandle?: string | null; nickname: string; userId: string }): string {
  if (item.instagramHandle) return `@${item.instagramHandle}`;
  return anonName(item.userId);
}
import Link from "next/link";
import { useRouter } from "next/navigation";
import HowToFlow from "@/components/how-to/HowToFlow";
import { useAuth } from "@/hooks/useAuth";
import { useAuditionAvailability } from "@/hooks/useAuditionAvailability";
import {
  readHowToHiddenPreference,
  readHowToSeenPreference,
  writeHowToHiddenPreference,
  writeHowToSeenPreference,
} from "@/lib/how-to";
import { PERSONAL_COLOR_LAB_ENABLED, TRACE_LAB_ENABLED } from "@/lib/feature-flags";
import {
  PERSONAL_COLOR_CONTROL_ID,
  applyStyleControl,
  resolveFeatureControlState,
  type StyleControlState,
} from "@/lib/style-controls";
import {
  ALL_STYLES,
  MULTI_SOURCE_STYLE_IDS,
  MULTI_SOURCE_STYLE_TAB,
  STYLE_CATEGORY_BY_ID,
  STYLE_CATEGORY_TABS,
  STYLE_LABELS,
} from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function formatStoryTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  return `${Math.floor(diffHour / 24)}d`;
}

const BASE_STYLE_CARDS = ALL_STYLES.map((s) => ({ ...s, bgImage: s.afterImg }));
const STORY_DURATION_MS = 4500;
const MULTI_SOURCE_STYLE_ID_SET = new Set<string>(MULTI_SOURCE_STYLE_IDS);
type StyleCard = (typeof BASE_STYLE_CARDS)[number];
type StudioSectionTab = "cards" | "lab";
type StyleCategoryTab = (typeof STYLE_CATEGORY_TABS)[number];
type UploadTarget = { mode: "single" } | { mode: "pair"; slotIndex: 0 | 1 };
type ShowcaseItem = {
  userId: string;
  nickname: string;
  profileImage: string | null;
  imageUrl: string;
  styleId: string | null;
  instagramHandle?: string | null;
  likeCount: number;
  createdAt: string;
};

type ShowcaseHistoryItem = {
  id: string;
  style_id: string;
  variant?: string;
  result_image_url: string;
  created_at: string;
};

type Toast = { id: number; message: string };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto max-w-sm w-full bg-[#1A1A1A] border border-white/10 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 cursor-pointer"
        >
          <span className="text-[#C9571A]">✦</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function PixelTraceTriggerIcon() {
  return (
    <div className="relative z-10 h-6 w-6" style={{ imageRendering: "pixelated" }}>
      <svg viewBox="0 0 16 16" className="h-full w-full drop-shadow-[0_0_12px_rgba(255,118,184,0.55)]">
        <g className="trace-pixel-sprite">
          <rect x="4" y="2" width="3" height="2" fill="#FFB2D8" />
          <rect x="9" y="2" width="3" height="2" fill="#FFB2D8" />
          <rect x="3" y="4" width="4" height="2" fill="#FF90C7" />
          <rect x="9" y="4" width="4" height="2" fill="#FF90C7" />
          <rect x="3" y="6" width="10" height="2" fill="#FF6FB8" />
          <rect x="4" y="8" width="8" height="2" fill="#FF5AAE" />
          <rect x="5" y="10" width="6" height="2" fill="#F2479F" />
          <rect x="6" y="12" width="4" height="2" fill="#E33690" />
          <rect x="5" y="3" width="1" height="1" fill="#FFF2FA" />
          <rect x="10" y="3" width="1" height="1" fill="#FFF2FA" />
          <rect x="2" y="4" width="1" height="3" fill="#5B1C3C" />
          <rect x="13" y="4" width="1" height="3" fill="#5B1C3C" />
          <rect x="4" y="13" width="1" height="1" fill="#5B1C3C" />
          <rect x="11" y="13" width="1" height="1" fill="#5B1C3C" />
        </g>
      </svg>
      <span className="trace-heart-spark absolute -right-0.5 top-0 h-[3px] w-[3px] bg-[#FFD8EE]" />
      <span className="trace-heart-spark-delayed absolute left-0.5 top-1 h-[2px] w-[2px] bg-[#FFC7E5]" />
      <span className="trace-heart-spark-soft absolute bottom-0.5 right-1 h-[2px] w-[2px] bg-[#FFF1F8]" />
      <span className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle,rgba(255,117,185,0.28)_0%,rgba(255,117,185,0)_72%)]" />
    </div>
  );
}

export default function Studio() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number> | null>(null);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [selectedShowcaseIndex, setSelectedShowcaseIndex] = useState<number | null>(null);
  const [showShowcaseJoinModal, setShowShowcaseJoinModal] = useState(false);
  const [showcaseHistory, setShowcaseHistory] = useState<ShowcaseHistoryItem[]>([]);
  const [showcaseHistoryLoading, setShowcaseHistoryLoading] = useState(false);
  const [selectedShowcaseHistoryId, setSelectedShowcaseHistoryId] = useState<string | null>(null);
  const [showcaseInstagram, setShowcaseInstagram] = useState("");
  const [showcaseSubmitting, setShowcaseSubmitting] = useState(false);
  const [likedShowcaseUserIds, setLikedShowcaseUserIds] = useState<string[]>([]);
  const [styleControls, setStyleControls] = useState<Record<string, StyleControlState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedStyleRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const { isLoading: isAuditionLoading, isVisible: isAuditionVisible, isEnabled: isAuditionEnabled } = useAuditionAvailability();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNoCreditModal, setShowNoCreditModal] = useState(false);
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [variantSelectStyle, setVariantSelectStyle] = useState<StyleCard | null>(null);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const [showPhotoSourceSheet, setShowPhotoSourceSheet] = useState(false);
  const [pairUploadStyle, setPairUploadStyle] = useState<StyleCard | null>(null);
  const [pairUploadImages, setPairUploadImages] = useState<[string | null, string | null]>([null, null]);
  const [pairSubmitting, setPairSubmitting] = useState(false);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [editorSize, setEditorSize] = useState(320);
  const [cropState, setCropState] = useState<{
    zoom: number;
    offsetX: number;
    offsetY: number;
    imageWidth: number;
    imageHeight: number;
    baseScale: number;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const uploadTargetRef = useRef<UploadTarget | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const touchStateRef = useRef<
    | {
        mode: "drag";
        startX: number;
        startY: number;
        startOffsetX: number;
        startOffsetY: number;
      }
    | {
        mode: "pinch";
        startDistance: number;
        startZoom: number;
        startCenterX: number;
        startCenterY: number;
        startOffsetX: number;
        startOffsetY: number;
      }
    | null
  >(null);
  const [notices, setNotices] = useState<{ id: number; text: string }[]>([]);
  const [visitors, setVisitors] = useState<{ today: number; total: number } | null>(null);
  const [activeSectionTab, setActiveSectionTab] = useState<StudioSectionTab>("cards");
  const [activeStyleCategory, setActiveStyleCategory] = useState<StyleCategoryTab>("전체");
  const generalCardsSectionRef = useRef<HTMLDivElement>(null);
  const labSectionRef = useRef<HTMLDivElement>(null);
  const appliedStyleQueryRef = useRef<string | null>(null);

  const loadShowcaseItems = useCallback(() => {
    fetch("/api/public-showcase", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setShowcaseItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setShowcaseItems([]));
  }, []);

  useEffect(() => {
    fetch("/api/remaining").then(r => r.json()).then(d => setRemaining(d.remaining)).catch(() => {});
    fetch("/api/credits").then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
    fetch("/api/notices").then(r => r.json()).then(d => setNotices(d.notices ?? [])).catch(() => {});
    fetch("/api/visitors", { method: "GET" }).then(r => r.json()).then(d => setVisitors(d)).catch(() => {});
    fetch("/api/style-controls")
      .then((r) => r.json())
      .then((data) => {
        const controls = Array.isArray(data.controls) ? data.controls : [];
        setStyleControls(Object.fromEntries(controls.map((control: StyleControlState) => [control.style_id, control])));
      })
      .catch(() => setStyleControls({}));
  }, []);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) console.error("[usage] API error:", data.error);
        setUsageCounts(data.counts ?? {});
      })
      .catch((e) => {
        console.error("[usage] fetch error:", e);
        setUsageCounts({});
      });
  }, []);

  useEffect(() => {
    loadShowcaseItems();
  }, [loadShowcaseItems]);

  useEffect(() => {
    if (selectedShowcaseIndex === null) {
      return;
    }

    if (!showcaseItems[selectedShowcaseIndex]) {
      setSelectedShowcaseIndex(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedShowcaseIndex((current) => {
        if (current === null) return null;
        if (current >= showcaseItems.length - 1) return null;
        return current + 1;
      });
    }, STORY_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedShowcaseIndex, showcaseItems]);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const allStyleCards = BASE_STYLE_CARDS
    .map((style) => {
      const control = styleControls[style.id];
      return {
        ...applyStyleControl(style, control),
        bgImage: style.afterImg,
      };
    })
    .filter((style) => !style.hidden);

  const styleOrder = allStyleCards.reduce<Record<string, number>>((acc, style, index) => {
    acc[style.id] = index;
    return acc;
  }, {});

  const styles = [...allStyleCards].sort((a, b) => {
    const aHasOptions = (STYLE_VARIANTS[a.id]?.length ?? 0) > 1;
    const bHasOptions = (STYLE_VARIANTS[b.id]?.length ?? 0) > 1;

    if (a.popular && b.popular) {
      const usageDiff = (usageCounts?.[b.id] ?? 0) - (usageCounts?.[a.id] ?? 0);
      if (usageDiff !== 0) return usageDiff;
      return styleOrder[a.id] - styleOrder[b.id];
    }
    if (a.popular) return -1;
    if (b.popular) return 1;

    if (aHasOptions && !bHasOptions) return -1;
    if (!aHasOptions && bHasOptions) return 1;

    return styleOrder[a.id] - styleOrder[b.id];
  });
  const filteredStyles =
    activeStyleCategory === "전체"
      ? styles
      : activeStyleCategory === MULTI_SOURCE_STYLE_TAB
        ? styles.filter((style) => MULTI_SOURCE_STYLE_ID_SET.has(style.id))
      : styles.filter((style) => STYLE_CATEGORY_BY_ID[style.id] === activeStyleCategory);
  const showAuditionLab = !isAuditionLoading && isAuditionVisible && isAuditionEnabled;
  const personalColorControl = resolveFeatureControlState(
    styleControls[PERSONAL_COLOR_CONTROL_ID],
    PERSONAL_COLOR_LAB_ENABLED
  );
  const showPersonalColorLab = personalColorControl.is_visible;
  const isPersonalColorEnabled = personalColorControl.is_enabled;
  const showNaboLab = true;
  const showLabSection = showAuditionLab || showPersonalColorLab || showNaboLab;

  const scrollToSection = useCallback((section: StudioSectionTab) => {
    const target = section === "cards" ? generalCardsSectionRef.current : labSectionRef.current;
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 112;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSectionTab(section);
  }, []);

  const handleStyleCategorySelect = useCallback((tab: StyleCategoryTab) => {
    setActiveStyleCategory(tab);
    scrollToSection("cards");
  }, [scrollToSection]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const requestedStyleId = new URLSearchParams(window.location.search).get("style");
    if (!requestedStyleId) return;
    if (appliedStyleQueryRef.current === requestedStyleId) return;

    const targetStyle = allStyleCards.find((style) => style.id === requestedStyleId);
    if (!targetStyle) return;

    appliedStyleQueryRef.current = requestedStyleId;
    setSelectedStyle(requestedStyleId);
    selectedStyleRef.current = requestedStyleId;
    setActiveSectionTab("cards");

    if (MULTI_SOURCE_STYLE_ID_SET.has(requestedStyleId)) {
      setActiveStyleCategory(MULTI_SOURCE_STYLE_TAB);
    } else {
      const category = STYLE_CATEGORY_BY_ID[requestedStyleId];
      if (category) {
        setActiveStyleCategory(category);
      }
    }

    requestAnimationFrame(() => {
      const section = generalCardsSectionRef.current;
      if (!section) return;
      const top = section.getBoundingClientRect().top + window.scrollY - 112;
      window.scrollTo({ top, behavior: "smooth" });
    });
  }, [allStyleCards]);

  const imageUrlToBase64 = useCallback(async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("이미지를 불러오지 못했어요.");
    const blob = await response.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("이미지 변환에 실패했어요."));
      };
      reader.onerror = () => reject(new Error("이미지 변환에 실패했어요."));
      reader.readAsDataURL(blob);
    });

    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("이미지 변환에 실패했어요.");
    return base64;
  }, []);

  const handleOpenShowcaseJoin = useCallback(async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setShowShowcaseJoinModal(true);
    setShowcaseHistoryLoading(true);

    try {
      const [historyRes, profileRes] = await Promise.all([
        fetch("/api/history", { cache: "no-store" }),
        fetch("/api/profile"),
      ]);
      const historyData = await historyRes.json();
      const history = Array.isArray(historyData?.history) ? historyData.history : [];
      setShowcaseHistory(history);
      setSelectedShowcaseHistoryId(history[0]?.id ?? null);

      const profileData = await profileRes.json().catch(() => ({}));
      if (profileData?.instagram_handle) {
        setShowcaseInstagram(profileData.instagram_handle);
      }
    } catch {
      setShowcaseHistory([]);
      setSelectedShowcaseHistoryId(null);
      showToast("최근 결과를 불러오지 못했어요.");
    } finally {
      setShowcaseHistoryLoading(false);
    }
  }, [showToast, user]);

  const handleSubmitShowcaseJoin = useCallback(async () => {
    if (!selectedShowcaseHistoryId) {
      showToast("올릴 결과 사진을 먼저 선택해주세요.");
      return;
    }

    const selectedItem = showcaseHistory.find((item) => item.id === selectedShowcaseHistoryId);
    if (!selectedItem) {
      showToast("선택한 결과를 찾지 못했어요.");
      return;
    }

    setShowcaseSubmitting(true);
    try {
      const imageBase64 = await imageUrlToBase64(selectedItem.result_image_url);
      const response = await fetch("/api/public-showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          styleId: selectedItem.style_id,
          variant: selectedItem.variant ?? "default",
          instagramHandle: showcaseInstagram,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "공개 스토리에 올리지 못했어요.");
      }

      await loadShowcaseItems();
      setShowShowcaseJoinModal(false);
      setShowcaseInstagram("");
      showToast("메인 공개 스토리에 추가했어요.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "공개 스토리에 올리지 못했어요.");
    } finally {
      setShowcaseSubmitting(false);
    }
  }, [imageUrlToBase64, loadShowcaseItems, selectedShowcaseHistoryId, showcaseHistory, showcaseInstagram, showToast]);

  useEffect(() => {
    if (selectedShowcaseIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedShowcaseIndex]);

  useEffect(() => {
    if (!showHowToModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showHowToModal]);

  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;
    if (readHowToHiddenPreference(userId)) return;
    if (readHowToSeenPreference(userId)) return;
    writeHowToSeenPreference(userId, true);
    setShowHowToModal(true);
  }, [loading, user?.id]);

  const activeShowcase = selectedShowcaseIndex !== null ? showcaseItems[selectedShowcaseIndex] ?? null : null;
  const activeShowcaseLiked = activeShowcase ? likedShowcaseUserIds.includes(activeShowcase.userId) : false;

  const closeStoryViewer = useCallback(() => {
    setSelectedShowcaseIndex(null);
  }, []);

  const openNextStory = useCallback(() => {
    setSelectedShowcaseIndex((current) => {
      if (current === null) return null;
      if (current >= showcaseItems.length - 1) return null;
      return current + 1;
    });
  }, [showcaseItems.length]);

  const openPreviousStory = useCallback(() => {
    setSelectedShowcaseIndex((current) => {
      if (current === null) return null;
      if (current <= 0) return 0;
      return current - 1;
    });
  }, []);

  const toggleStoryLike = useCallback(() => {
    if (!activeShowcase) return;
    const wasLiked = likedShowcaseUserIds.includes(activeShowcase.userId);
    const liked = !wasLiked;
    setLikedShowcaseUserIds((current) =>
      wasLiked
        ? current.filter((id) => id !== activeShowcase.userId)
        : [...current, activeShowcase.userId]
    );
    // 낙관적 카운트 업데이트
    setShowcaseItems((current) =>
      current.map((item) =>
        item.userId === activeShowcase.userId
          ? { ...item, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) }
          : item
      )
    );
    fetch("/api/showcase-likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: activeShowcase.userId, liked }),
    }).catch(() => {});
  }, [activeShowcase, likedShowcaseUserIds]);

  useEffect(() => {
    if (selectedShowcaseIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeStoryViewer();
      if (event.key === "ArrowRight") openNextStory();
      if (event.key === "ArrowLeft") openPreviousStory();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeStoryViewer, openNextStory, openPreviousStory, selectedShowcaseIndex]);

  useEffect(() => {
    if (!showLabSection) return;

    const updateActiveSection = () => {
      const threshold = 132;
      const labTop = labSectionRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      setActiveSectionTab(labTop <= threshold ? "lab" : "cards");
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [showLabSection]);

  const handleCardClick = (style: StyleCard) => {
    if (!style.active) {
      showToast(styleControls[style.id]?.is_enabled === false ? "현재 점검 중입니다. 잠시 후 다시 확인해주세요." : "곧 출시됩니다 ✨");
      return;
    }
    if (!user && remaining === 0) {
      setShowLoginModal(true);
      return;
    }
    if (user && credits === 0) {
      setShowNoCreditModal(true);
      return;
    }
    setSelectedStyle(style.id);
    selectedStyleRef.current = style.id;

    if (MULTI_SOURCE_STYLE_ID_SET.has(style.id)) {
      sessionStorage.setItem("sd_variant", "default");
      setPairUploadImages([null, null]);
      setPairUploadStyle(style);
      uploadTargetRef.current = null;
      return;
    }

    const variants = STYLE_VARIANTS[style.id];
    if (variants && variants.length > 1) {
      // 베리에이션 있는 스타일 → 옵션 모달 먼저
      setVariantSelectStyle(style);
    } else {
      // 베리에이션 없음 → 촬영/앨범 선택 시트
      sessionStorage.setItem("sd_variant", "default");
      uploadTargetRef.current = { mode: "single" };
      setShowPhotoSourceSheet(true);
    }
  };

  const handlePersonalColorClick = () => {
    if (!isPersonalColorEnabled) {
      showToast("현재 점검 중입니다. 잠시 후 다시 확인해주세요.");
      return;
    }

    router.push("/personal-color");
  };

  // 카메라 가이드 — 스트림 시작/정리
  useEffect(() => {
    if (!showCameraGuide) return;
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => {
        if (!active) return;
        setShowCameraGuide(false);
        fileInputRef.current?.click();
      });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [showCameraGuide]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowCameraGuide(false);
  };

  const clampCropOffsets = useCallback((next: {
    zoom: number;
    offsetX: number;
    offsetY: number;
    imageWidth: number;
    imageHeight: number;
    baseScale: number;
  }) => {
    const displayScale = next.baseScale * next.zoom;
    const displayWidth = next.imageWidth * displayScale;
    const displayHeight = next.imageHeight * displayScale;
    const limitX = Math.max(0, (displayWidth - editorSize) / 2);
    const limitY = Math.max(0, (displayHeight - editorSize) / 2);

    return {
      ...next,
      offsetX: Math.min(limitX, Math.max(-limitX, next.offsetX)),
      offsetY: Math.min(limitY, Math.max(-limitY, next.offsetY)),
    };
  }, [editorSize]);

  const resetCropState = useCallback(() => {
    setCropState((prev) => prev ? { ...prev, zoom: 1, offsetX: 0, offsetY: 0 } : prev);
  }, []);

  const loadDataUrlImage = useCallback((dataUrl: string) => (
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
      img.src = dataUrl;
    })
  ), []);

  const resizeImageDataUrl = useCallback(async (dataUrl: string) => {
    const img = await loadDataUrlImage(dataUrl);
    const canvas = document.createElement("canvas");
    let width = img.width;
    let height = img.height;
    const MAX_SIZE = 1024;
    if (width > height) {
      if (width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      }
    } else if (height > MAX_SIZE) {
      width *= MAX_SIZE / height;
      height = MAX_SIZE;
    }
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 처리를 시작하지 못했어요.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, [loadDataUrlImage]);

  const composePairPreviewDataUrl = useCallback(async (dataUrls: [string, string]) => {
    const [leftImage, rightImage] = await Promise.all(dataUrls.map(loadDataUrlImage));
    const canvas = document.createElement("canvas");
    const size = 1024;
    const half = size / 2;
    const padding = 24;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("미리보기를 만들지 못했어요.");

    const drawContain = (img: HTMLImageElement, dx: number) => {
      const frameWidth = half - padding * 2;
      const frameHeight = size - padding * 2;
      const scale = Math.min(frameWidth / img.width, frameHeight / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = dx + padding + (frameWidth - drawWidth) / 2;
      const offsetY = padding + (frameHeight - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, half, size);
    ctx.fillRect(half, 0, half, size);
    drawContain(leftImage, 0);
    drawContain(rightImage, half);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(half - 2, 48, 4, size - 96);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, [loadDataUrlImage]);

  const finalizeSingleUpload = useCallback(async (dataUrl: string) => {
    const styleId = selectedStyleRef.current;
    if (!styleId) return;
    const resized = await resizeImageDataUrl(dataUrl);
    sessionStorage.setItem("sd_styleId", styleId);
    sessionStorage.setItem("sd_imageBase64", resized.split(",")[1]);
    sessionStorage.setItem("sd_previewDataUrl", resized);
    sessionStorage.removeItem("sd_imageBase64List");
    sessionStorage.removeItem("sd_resultDataUrl");
    sessionStorage.removeItem("sd_shareUrl");
    sessionStorage.removeItem("sd_shareLink");
    sessionStorage.setItem("sd_fromStudio", "1");
    router.push("/result");
  }, [resizeImageDataUrl, router]);

  const handleGeneratePairUpload = useCallback(async () => {
    const styleId = selectedStyleRef.current;
    if (!styleId) return;
    const [first, second] = pairUploadImages;
    if (!first || !second) {
      showToast("두 사람 사진을 모두 올려주세요.");
      return;
    }

    setPairSubmitting(true);
    try {
      const normalized = await Promise.all([
        resizeImageDataUrl(first),
        resizeImageDataUrl(second),
      ]) as [string, string];
      const preview = await composePairPreviewDataUrl(normalized);
      sessionStorage.setItem("sd_styleId", styleId);
      sessionStorage.setItem("sd_imageBase64", preview.split(",")[1]);
      sessionStorage.setItem("sd_imageBase64List", JSON.stringify(normalized.map((item) => item.split(",")[1])));
      sessionStorage.setItem("sd_previewDataUrl", preview);
      sessionStorage.removeItem("sd_resultDataUrl");
      sessionStorage.removeItem("sd_shareUrl");
      sessionStorage.removeItem("sd_shareLink");
      sessionStorage.setItem("sd_fromStudio", "1");
      setPairUploadStyle(null);
      setPairUploadImages([null, null]);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.push("/result");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "두 장 업로드를 처리하지 못했어요.");
    } finally {
      setPairSubmitting(false);
    }
  }, [composePairPreviewDataUrl, pairUploadImages, resizeImageDataUrl, router, showToast]);

  const processImageDataUrl = useCallback(async (dataUrl: string) => {
    const target = uploadTargetRef.current ?? { mode: "single" as const };
    if (target.mode === "pair") {
      setPairUploadImages((prev) => {
        const next: [string | null, string | null] = [...prev] as [string | null, string | null];
        next[target.slotIndex] = dataUrl;
        return next;
      });
      showToast(target.slotIndex === 0 ? "첫 번째 인물 사진을 담았어요." : "두 번째 인물 사진을 담았어요.");
      return;
    }

    await finalizeSingleUpload(dataUrl);
  }, [finalizeSingleUpload, showToast]);

  const openImageConfirm = useCallback((dataUrl: string) => {
    setPendingImagePreview(dataUrl);
  }, []);

  const closeImageConfirm = useCallback(() => {
    setPendingImagePreview(null);
    setCropState(null);
    uploadTargetRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!pendingImagePreview) return;

    const measure = () => {
      const nextSize = cropFrameRef.current?.clientWidth;
      if (!nextSize) return;
      setEditorSize(nextSize);
      setCropState((prev) => {
        if (!prev) return prev;
        const nextBaseScale = Math.max(nextSize / prev.imageWidth, nextSize / prev.imageHeight);
        return clampCropOffsets({ ...prev, baseScale: nextBaseScale });
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pendingImagePreview, clampCropOffsets]);

  useEffect(() => {
    if (!pendingImagePreview) return;

    const img = new Image();
    img.onload = () => {
      const frameSize = cropFrameRef.current?.clientWidth ?? editorSize;
      const baseScale = Math.max(frameSize / img.width, frameSize / img.height);
      setEditorSize(frameSize);
      setCropState({
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        imageWidth: img.width,
        imageHeight: img.height,
        baseScale,
      });
    };
    img.src = pendingImagePreview;
  }, [pendingImagePreview, editorSize]);

  const handleConfirmSelectedImage = useCallback(() => {
    if (!pendingImagePreview) return;
    if (!cropState) {
      void processImageDataUrl(pendingImagePreview);
      setPendingImagePreview(null);
      setCropState(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const img = new Image();
    img.onload = () => {
      const outputSize = 1024;
      const displayScale = cropState.baseScale * cropState.zoom;
      const displayWidth = cropState.imageWidth * displayScale;
      const displayHeight = cropState.imageHeight * displayScale;
      const imageLeft = (editorSize - displayWidth) / 2 + cropState.offsetX;
      const imageTop = (editorSize - displayHeight) / 2 + cropState.offsetY;
      const sourceX = Math.max(0, -imageLeft / displayScale);
      const sourceY = Math.max(0, -imageTop / displayScale);
      const sourceWidth = Math.min(cropState.imageWidth, editorSize / displayScale);
      const sourceHeight = Math.min(cropState.imageHeight, editorSize / displayScale);

      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputSize,
        outputSize
      );

      void processImageDataUrl(canvas.toDataURL("image/jpeg", 0.9));
      setPendingImagePreview(null);
      setCropState(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    img.src = pendingImagePreview;
  }, [cropState, editorSize, pendingImagePreview, processImageDataUrl]);

  const handleCropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropState) return;
    if (event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: cropState.offsetX,
      startOffsetY: cropState.offsetY,
    };
  }, [cropState]);

  const handleCropPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropState) return;
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    setCropState((prev) => prev ? clampCropOffsets({
      ...prev,
      offsetX: dragState.startOffsetX + deltaX,
      offsetY: dragState.startOffsetY + deltaY,
    }) : prev);
  }, [cropState, clampCropOffsets]);

  const handleCropPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleCropTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!cropState) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchStateRef.current = {
        mode: "drag",
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: cropState.offsetX,
        startOffsetY: cropState.offsetY,
      };
      return;
    }

    if (event.touches.length >= 2) {
      const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
      const dx = secondTouch.clientX - firstTouch.clientX;
      const dy = secondTouch.clientY - firstTouch.clientY;
      const centerX = (firstTouch.clientX + secondTouch.clientX) / 2;
      const centerY = (firstTouch.clientY + secondTouch.clientY) / 2;
      touchStateRef.current = {
        mode: "pinch",
        startDistance: Math.hypot(dx, dy),
        startZoom: cropState.zoom,
        startCenterX: centerX,
        startCenterY: centerY,
        startOffsetX: cropState.offsetX,
        startOffsetY: cropState.offsetY,
      };
    }
  }, [cropState]);

  const handleCropTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!cropState || !touchStateRef.current) return;
    event.preventDefault();

    const state = touchStateRef.current;

    if (state.mode === "drag" && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      setCropState((prev) => prev ? clampCropOffsets({
        ...prev,
        offsetX: state.startOffsetX + deltaX,
        offsetY: state.startOffsetY + deltaY,
      }) : prev);
      return;
    }

    if (state.mode === "pinch" && event.touches.length >= 2) {
      const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
      const dx = secondTouch.clientX - firstTouch.clientX;
      const dy = secondTouch.clientY - firstTouch.clientY;
      const currentDistance = Math.hypot(dx, dy);
      const centerX = (firstTouch.clientX + secondTouch.clientX) / 2;
      const centerY = (firstTouch.clientY + secondTouch.clientY) / 2;
      const nextZoom = Math.max(1, Math.min(2.6, state.startZoom * (currentDistance / state.startDistance)));
      const deltaCenterX = centerX - state.startCenterX;
      const deltaCenterY = centerY - state.startCenterY;

      setCropState((prev) => prev ? clampCropOffsets({
        ...prev,
        zoom: nextZoom,
        offsetX: state.startOffsetX + deltaCenterX,
        offsetY: state.startOffsetY + deltaCenterY,
      }) : prev);
    }
  }, [cropState, clampCropOffsets]);

  const handleCropTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!cropState) {
      touchStateRef.current = null;
      return;
    }

    if (event.touches.length === 0) {
      touchStateRef.current = null;
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchStateRef.current = {
        mode: "drag",
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: cropState.offsetX,
        startOffsetY: cropState.offsetY,
      };
      return;
    }

    if (event.touches.length >= 2) {
      const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
      const dx = secondTouch.clientX - firstTouch.clientX;
      const dy = secondTouch.clientY - firstTouch.clientY;
      touchStateRef.current = {
        mode: "pinch",
        startDistance: Math.hypot(dx, dy),
        startZoom: cropState.zoom,
        startCenterX: (firstTouch.clientX + secondTouch.clientX) / 2,
        startCenterY: (firstTouch.clientY + secondTouch.clientY) / 2,
        startOffsetX: cropState.offsetX,
        startOffsetY: cropState.offsetY,
      };
    }
  }, [cropState]);

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // 셀카이므로 좌우 반전 해제
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    stopCamera();
    openImageConfirm(canvas.toDataURL("image/jpeg", 0.85));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const styleId = selectedStyleRef.current;
    if (!styleId) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1024;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      openImageConfirm(dataUrl);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes tracePulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes traceGlow {
          0%, 100% { opacity: 0.3; transform: scale(0.92); }
          50% { opacity: 0.7; transform: scale(1.18); }
        }
        @keyframes tracePixelFloat {
          0%, 100% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(-0.5px, -1.5px, 0); }
          50% { transform: translate3d(0.5px, -3px, 0); }
          75% { transform: translate3d(-0.5px, -1.5px, 0); }
        }
        @keyframes traceHeartSpark {
          0%, 100% { opacity: 0.28; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.45); }
        }
        .trace-pixel-sprite {
          animation: tracePixelFloat 1.6s steps(2, end) infinite;
          transform-origin: center;
        }
        .trace-heart-spark {
          animation: traceHeartSpark 1.15s steps(2, end) infinite;
        }
        .trace-heart-spark-delayed {
          animation: traceHeartSpark 1.45s steps(2, end) infinite reverse;
        }
        .trace-heart-spark-soft {
          animation: traceHeartSpark 1.8s steps(2, end) infinite;
        }
      `}</style>
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

        {/* Header */}
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
            {TRACE_LAB_ENABLED && (
              <Link
                href="/lab/traces"
                aria-label="실험실 흔적 지도"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#6BE2C5]/20 bg-[#071110] shadow-[0_0_20px_rgba(107,226,197,0.14)]"
                style={{ animation: "tracePulse 2.2s ease-in-out infinite" }}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-full border border-[#6BE2C5]/28"
                  style={{ animation: "traceGlow 2.2s ease-in-out infinite" }}
                />
                <PixelTraceTriggerIcon />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FFE082]" style={{ animation: "blink 1.3s step-end infinite" }} />
              </Link>
            )}
          </div>
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <Link href="/shop" className="flex items-center gap-1.5 bg-[#1A1A1A] border border-white/8 px-3 py-1.5 rounded-full hover:border-[#C9571A]/40 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1h2l1.5 7h7l1-4.5H4" stroke="#C9571A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="6.5" cy="12" r="0.8" fill="#C9571A"/>
                    <circle cx="11" cy="12" r="0.8" fill="#C9571A"/>
                  </svg>
                  <span className="text-[11px] text-[#C9571A] font-bold">{credits !== null ? `${credits}크레딧` : "충전"}</span>
                </Link>
                <button onClick={() => router.push("/mypage")} className="flex items-center gap-2">
                  {user.profileImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
                  )}
                  <span className="text-[14px] font-medium text-white truncate max-w-[80px]">{user.nickname}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setLoginLoading(true); login(); }}
                disabled={loginLoading}
                className="bg-[#FEE500] text-[#3C1E1E] text-[13px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-70"
              >
                {loginLoading && <span className="w-3.5 h-3.5 rounded-full border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E] inline-block" style={{ animation: "spin 0.7s linear infinite" }} />}
                {loginLoading ? "연결 중..." : "카카오 로그인"}
              </button>
            )
          )}
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-4">
          <style>{`main * { letter-spacing: -1.5%; }`}</style>

          {/* 터미널 공지 — 최상단 */}
          {notices.length > 0 && (
            <div className="mb-5 bg-[#0D0D0D] border border-[#2a2a2a] rounded-xl px-4 py-3 font-mono overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                  <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                  <div className="w-2 h-2 rounded-full bg-[#28c840]" />
                  <span className="ml-1 text-[10px] text-[#444] tracking-wide">notice</span>
                </div>
                {visitors && (
                  <div className="flex items-center gap-2 text-[10px] text-[#444] font-mono">
                    <span className="flex items-center gap-1">
                      <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                        <circle cx="3" cy="3" r="3" fill="#C9571A" opacity="0.6"/>
                      </svg>
                      오늘 {visitors.today.toLocaleString()}
                    </span>
                    <span className="text-[#333]">·</span>
                    <span>누적 {visitors.total.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {notices.map((n, i) => (
                <p key={n.id} className={`text-[12px] text-[#888] leading-relaxed ${i > 0 ? "mt-1" : ""}`}>
                  <span className="text-[#C9571A]">›</span>{" "}
                  <span className="text-white/60">{n.text}</span>
                  {i === notices.length - 1 && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#C9571A]/70 ml-1 align-middle" style={{ animation: "blink 1.2s step-end infinite" }} />
                  )}
                </p>
              ))}
            </div>
          )}

          {(showcaseItems.length > 0 || user) && (
            <div className="mb-5">
              <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max gap-3 px-1 pb-1">
                  <button
                    type="button"
                    onClick={handleOpenShowcaseJoin}
                    className="group flex w-[78px] shrink-0 flex-col items-center gap-2"
                  >
                    <div className="rounded-full bg-[linear-gradient(135deg,#C9571A,#F6B38C,#C9571A)] p-[2px] shadow-[0_10px_24px_rgba(201,87,26,0.16)]">
                      <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#0A0A0A]">
                        <div className="relative h-[22px] w-[22px] text-white/82">
                          <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-current" />
                          <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 rounded-full bg-current" />
                        </div>
                      </div>
                    </div>
                    <span className="line-clamp-1 text-center text-[11px] font-medium text-white/72">
                      나도 추가하기
                    </span>
                  </button>
                  {showcaseItems.map((item, index) => (
                    <button
                      key={`${item.userId}-${item.createdAt}`}
                      type="button"
                      onClick={() => setSelectedShowcaseIndex(index)}
                      className="group flex w-[78px] shrink-0 flex-col items-center gap-2"
                    >
                      <div className="rounded-full bg-[linear-gradient(135deg,#C9571A,#F6B38C,#C9571A)] p-[2px] shadow-[0_10px_24px_rgba(201,87,26,0.16)]">
                        <div className="rounded-full bg-[#0A0A0A] p-[3px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.nickname}
                            className="h-[64px] w-[64px] rounded-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                            draggable={false}
                          />
                        </div>
                      </div>
                      <span className="line-clamp-1 text-center text-[11px] font-medium text-white/72">
                        {showcaseDisplayName(item)}님
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showLabSection && (
            <div className="sticky top-[60px] z-30 mb-4">
              <div className="rounded-2xl border border-white/8 bg-[#111]/95 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] px-2 pt-2 pb-1.5">
                {/* 메인 탭 */}
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <button
                    onClick={() => scrollToSection("cards")}
                    className={`rounded-xl py-2 text-[13px] font-bold transition-colors ${
                      activeSectionTab === "cards"
                        ? "bg-[#C9571A] text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    일반 카드
                  </button>
                  <button
                    onClick={() => scrollToSection("lab")}
                    className={`rounded-xl py-2 text-[13px] font-bold transition-colors ${
                      activeSectionTab === "lab"
                        ? "bg-[#C9571A] text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    실험실
                  </button>
                </div>
                {/* 카테고리 필터 */}
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max items-center gap-0.5 px-0.5">
                    {STYLE_CATEGORY_TABS.map((tab) => {
                      const isActive = activeStyleCategory === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => handleStyleCategorySelect(tab)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                            isActive
                              ? "bg-[#C9571A]/20 text-[#F6B38C]"
                              : "text-white/35 hover:text-white/60"
                          }`}
                        >
                          {tab}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={generalCardsSectionRef}>
            {/* 스타일 선택 섹션 헤더 */}
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[20px] font-bold text-[#C9571A]">스타일 선택</h2>
                <p className="mt-1 text-[18px] font-bold text-white">원하는 스타일의 카드를 선택해봐요</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHowToModal(true)}
                className="inline-flex h-12 min-w-[112px] shrink-0 items-center justify-center rounded-2xl bg-[#C9571A] px-6 text-[14px] font-extrabold text-white shadow-[0_10px_24px_rgba(201,87,26,0.24)] transition-all hover:scale-[1.02] hover:bg-[#B84E19]"
              >
                사용방법
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filteredStyles.map((style) => {
                const hasOptions = (STYLE_VARIANTS[style.id]?.length ?? 0) > 1;

                return (
                  <button
                    key={style.id}
                    onClick={() => handleCardClick(style)}
                    className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all duration-300 border-2 ${
                      selectedStyle === style.id
                        ? "border-[#C9571A] shadow-[0_4px_24px_rgb(201,87,26,0.3)]"
                        : "border-transparent"
                    } ${!style.active ? "cursor-default" : "cursor-pointer"}`}
                    style={{ backgroundColor: style.bgColor }}
                  >
                  {/* Split before/after for active cards with images */}
                  {style.beforeImg && style.afterImg ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={style.beforeImg} alt="before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={style.afterImg} alt="after" className="absolute inset-0 w-full h-full object-cover" style={{ animation: "split-clip 4s ease-in-out infinite" }} draggable={false} />
                      <div className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]" style={{ animation: "split-line 4s ease-in-out infinite" }}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center">
                          <svg width="14" height="10" viewBox="0 0 20 10" fill="none">
                            <path d="M1 5H19M1 5L5 2M1 5L5 8M19 5L15 2M19 5L15 8" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : style.bgImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={style.bgImage} alt={style.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                  ) : null}

                  {/* Coming soon dim */}
                  {!style.active && <div className="absolute inset-0 bg-black/50" />}

                  {/* Bottom gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Bottom left text */}
                  <div className="absolute bottom-0 left-0 p-5">
                    <div className="flex items-center gap-2 mb-0.5">
                      {hasOptions && (
                        <span className="inline-flex items-center rounded-lg bg-white/14 px-2 py-1 text-[11px] font-extrabold text-white backdrop-blur-md ring-1 ring-white/15">
                          옵션
                        </span>
                      )}
                      <p className="text-[24px] font-bold text-white tracking-tight leading-tight">{style.name}</p>
                    </div>
                    <p className="text-[14px] text-[#ccc] mt-0.5 break-keep">{style.desc}</p>
                    {style.active && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="flex items-center gap-1.5 text-[13px] text-white/80 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="5" r="3.2" fill="currentColor" fillOpacity="0.85"/>
                            <path d="M1 15c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round"/>
                          </svg>
                          {usageCounts === null ? "..." : formatCount(usageCounts[style.id] ?? 0)}
                        </span>
                        {MULTI_SOURCE_STYLE_ID_SET.has(style.id) ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-[#C9571A] rounded-lg shadow-lg">
                            <span className="text-[11px] font-extrabold text-white whitespace-nowrap">✦✦ 2크레딧</span>
                          </div>
                        ) : (
                          <div className="flex items-center px-2 py-1 bg-[#C9571A]/20 border border-[#C9571A]/30 rounded-lg backdrop-blur-md">
                            <span className="text-[11px] font-extrabold text-[#C9571A] whitespace-nowrap">1크레딧</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Popular Badge */}
                  {style.popular && (
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-[#C9571A] text-white text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl shadow-lg ring-1 ring-white/20 scale-105 origin-top-left transition-transform">
                      <span>인기</span>
                      <span className="text-[13px] leading-none -mt-0.5">🔥</span>
                    </div>
                  )}


                  {/* Selected check */}
                  {selectedStyle === style.id && (
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#C9571A] flex items-center justify-center shadow-md">
                      <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5L4.5 8.5L13 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  </button>
                );
              })}
            </div>
          </div>

          {showLabSection && (
            <>
              <div ref={labSectionRef}>
                {/* 실험실 섹션 헤더 */}
                <div className="mt-8 mb-4">
                  <h2 className="text-[20px] font-bold text-[#C9571A]">실험실</h2>
                  <p className="text-[18px] font-bold text-white mt-1">색다른 AI 기능을 체험해봐요</p>
                </div>

                {showNaboLab && (
                  <Link href="/nabo" className="block mb-4 active:scale-[0.97] transition-transform">
                    <div className="relative rounded-2xl overflow-hidden bg-[#040D07] border border-white/[0.07]" style={{ aspectRatio: '4/3' }}>

                      {/* ── 배경: 그린 코너 글로우 ── */}
                      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 10% 100%, rgba(34,197,94,0.16) 0%, transparent 70%)' }} />

                      {/* ── 배경 대형 ANONYMOUS 워터마크 ── */}
                      <span
                        className="absolute select-none z-[1] font-unbounded font-black"
                        style={{
                          bottom: '-2%', right: '-4%',
                          fontSize: 'clamp(44px, 13vw, 76px)',
                          lineHeight: 1,
                          letterSpacing: '-3px',
                          color: 'rgba(255,255,255,0.03)',
                          whiteSpace: 'nowrap',
                        }}
                      >ANONYMOUS</span>

                      {/* ── 상단 레이블 바 ── */}
                      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
                        <span
                          className="font-unbounded font-medium text-[#22C55E] tracking-[0.18em] uppercase"
                          style={{ fontSize: 'clamp(9px, 2.4vw, 11px)' }}
                        >Anonymous Lab</span>
                        <span className="text-[10px] font-bold text-white/30 border border-white/15 rounded-full px-2.5 py-0.5 tracking-widest uppercase"
                          style={{ fontFamily: '"Unbounded", sans-serif' }}>Beta</span>
                      </div>

                      {/* ── 메인 타이틀 블록 ── */}
                      <div className="absolute z-10 flex flex-col" style={{ top: '28%', left: '6%' }}>
                        <div className="w-6 h-[2px] bg-[#22C55E] mb-3" />
                        <span
                          className="font-unbounded font-bold text-white/40 uppercase tracking-[0.06em] mb-1"
                          style={{ fontSize: 'clamp(10px, 2.6vw, 13px)' }}
                        >Who sees you?</span>
                        <span
                          className="text-white leading-[0.9]"
                          style={{
                            fontFamily: '"BMKkubulim", sans-serif',
                            fontSize: 'clamp(36px, 10.5vw, 60px)',
                            letterSpacing: '-1px',
                          }}
                        >내가 보는 너</span>
                      </div>

                      {/* ── 설명 텍스트 ── */}
                      <div className="absolute z-10" style={{ top: '68%', left: '6%', right: '6%' }}>
                        <p
                          className="text-white/50 leading-snug"
                          style={{ fontFamily: '"Pretendard", sans-serif', fontSize: 'clamp(11px, 2.8vw, 13px)', fontWeight: 500 }}
                        >
                          {usageCounts === null ? "..." : `${formatCount(usageCounts["nabo"] ?? 0)}명 참여`} · 관계 분석 리포트<br />
                          <span className="text-white/30">누가 뭐라 했는지는 절대 안 보여요</span>
                        </p>
                      </div>

                      {/* ── 바텀 바: 참여 수 + 무료 + 화살표 ── */}
                      <div className="absolute z-20 flex items-center justify-between" style={{ bottom: '6%', left: '6%', right: '6%' }}>
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center gap-1.5 text-white/40 border border-white/10 rounded-full px-2.5 py-1"
                            style={{ fontFamily: '"Pretendard", sans-serif', fontSize: 'clamp(10px, 2.5vw, 12px)' }}
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="5" r="3.2" fill="currentColor" fillOpacity="0.8"/>
                              <path d="M1 15c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round"/>
                            </svg>
                            {usageCounts === null ? "..." : `${formatCount(usageCounts["nabo"] ?? 0)}명 참여`}
                          </span>
                          <span
                            className="text-[#22C55E] border border-[#22C55E]/40 rounded-full px-2.5 py-1 font-bold"
                            style={{ fontFamily: '"Unbounded", sans-serif', fontSize: 'clamp(9px, 2.2vw, 11px)' }}
                          >5크레딧</span>
                        </div>

                        <div className="w-9 h-9 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>

                      {/* ── 그린 수직선 장식 (우측) ── */}
                      <div className="absolute right-6 z-10" style={{ top: '28%', bottom: '20%', width: '1.5px', background: 'linear-gradient(to bottom, transparent, rgba(34,197,94,0.5), transparent)' }} />

                    </div>
                  </Link>
                )}

                <Link href="/travel-together" className="block mb-4 active:scale-[0.97] transition-transform">
                  <div className="relative rounded-2xl overflow-hidden bg-[#07101D] border border-white/[0.07]" style={{ aspectRatio: "4/3" }}>

                    <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 60% at 10% 100%, rgba(59,130,246,0.18) 0%, transparent 70%)" }} />

                    <span
                      className="absolute select-none z-[1] font-unbounded font-black"
                      style={{
                        bottom: "-2%",
                        right: "-4%",
                        fontSize: "clamp(44px, 13vw, 76px)",
                        lineHeight: 1,
                        letterSpacing: "-3px",
                        color: "rgba(255,255,255,0.03)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      TRAVEL
                    </span>

                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
                      <span
                        className="font-unbounded font-medium text-[#3B82F6] tracking-[0.18em] uppercase"
                        style={{ fontSize: "clamp(9px, 2.4vw, 11px)" }}
                      >
                        Travel Match
                      </span>
                      <span
                        className="text-[10px] font-bold text-white/30 border border-white/15 rounded-full px-2.5 py-0.5 tracking-widest uppercase"
                        style={{ fontFamily: '"Unbounded", sans-serif' }}
                      >
                        Beta
                      </span>
                    </div>

                    <div className="absolute z-10 flex flex-col" style={{ top: "28%", left: "6%", right: "6%" }}>
                      <div className="w-6 h-[2px] bg-[#3B82F6] mb-3" />
                      <span
                        className="font-unbounded font-bold text-white/40 uppercase tracking-[0.06em] mb-1"
                        style={{ fontSize: "clamp(10px, 2.6vw, 13px)" }}
                      >
                        Trip chemistry
                      </span>
                      <span
                        className="text-white leading-[0.9]"
                        style={{
                          fontFamily: '"BMKkubulim", sans-serif',
                          fontSize: "clamp(28px, 7.8vw, 46px)",
                          letterSpacing: "-1px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        여행을 같이 간다면
                      </span>
                    </div>

                    <div className="absolute z-10" style={{ top: "68%", left: "6%", right: "6%" }}>
                      <p
                        className="text-white/50 leading-snug"
                        style={{ fontFamily: '"Pretendard", sans-serif', fontSize: "clamp(11px, 2.8vw, 13px)", fontWeight: 500 }}
                      >
                        {usageCounts === null ? "..." : `${formatCount(usageCounts["travel_together"] ?? 0)}명 참여`} · 티어 결과 · 여행지 추천
                        <br />
                        <span className="text-white/30">같이 가면 진짜 맞는지 먼저 봅니다</span>
                      </p>
                    </div>

                    <div className="absolute z-20 flex items-center justify-between" style={{ bottom: "6%", left: "6%", right: "6%" }}>
                      <div className="flex items-center gap-2">
                        <span
                          className="flex items-center gap-1.5 text-white/40 border border-white/10 rounded-full px-2.5 py-1"
                          style={{ fontFamily: '"Pretendard", sans-serif', fontSize: "clamp(10px, 2.5vw, 12px)" }}
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                            <circle cx="5" cy="5" r="3" fill="currentColor" fillOpacity="0.8" />
                            <circle cx="11" cy="5.5" r="2.6" fill="currentColor" fillOpacity="0.55" />
                            <path d="M1.2 14.8c0-3.2 2.7-5.8 5.9-5.8s5.8 2.6 5.8 5.8" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                          {usageCounts === null ? "..." : `${formatCount(usageCounts["travel_together"] ?? 0)}명 참여`}
                        </span>
                        <span
                          className="text-[#60A5FA] border border-[#60A5FA]/40 rounded-full px-2.5 py-1 font-bold"
                          style={{ fontFamily: '"Unbounded", sans-serif', fontSize: "clamp(9px, 2.2vw, 11px)" }}
                        >
                          NEW
                        </span>
                      </div>

                      <div className="w-9 h-9 rounded-full bg-[#3B82F6] flex items-center justify-center flex-shrink-0">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute right-6 z-10" style={{ top: "28%", bottom: "20%", width: "1.5px", background: "linear-gradient(to bottom, transparent, rgba(59,130,246,0.5), transparent)" }} />
                  </div>
                </Link>

                {showAuditionLab && (
                  <Link href="/audition/intro" className="block mb-4 active:scale-[0.97] transition-transform">
                    <div className="relative rounded-2xl overflow-hidden bg-[#0A0A0A] border border-white/[0.07]" style={{ aspectRatio: '4/3' }}>

                {/* ── 배경: 미묘한 오렌지 코너 글로우 ── */}
                <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 10% 100%, rgba(201,87,26,0.18) 0%, transparent 70%)' }} />

                {/* ── 배경 대형 AUDITION 워터마크 ── */}
                <span
                  className="absolute select-none z-[1] font-unbounded font-black"
                  style={{
                    bottom: '-2%', right: '-4%',
                    fontSize: 'clamp(52px, 16vw, 88px)',
                    lineHeight: 1,
                    letterSpacing: '-3px',
                    color: 'rgba(255,255,255,0.03)',
                    whiteSpace: 'nowrap',
                  }}
                >AUDITION</span>

                {/* ── 상단 레이블 바 ── */}
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
                  <span
                    className="font-unbounded font-medium text-[#C9571A] tracking-[0.18em] uppercase"
                    style={{ fontSize: 'clamp(9px, 2.4vw, 11px)' }}
                  >AI Audition</span>
                  <span className="text-[10px] font-bold text-white/30 border border-white/15 rounded-full px-2.5 py-0.5 tracking-widest uppercase"
                    style={{ fontFamily: '"Unbounded", sans-serif' }}>NEW</span>
                </div>

                {/* ── 메인 타이틀 블록 ── */}
                <div className="absolute z-10 flex flex-col" style={{ top: '28%', left: '6%' }}>
                  <div className="w-6 h-[2px] bg-[#C9571A] mb-3" />
                  <span
                    className="font-unbounded font-bold text-white/40 uppercase tracking-[0.06em] mb-1"
                    style={{ fontSize: 'clamp(10px, 2.6vw, 13px)' }}
                  >Are you an actor?</span>
                  <span
                    className="text-white leading-[0.9]"
                    style={{
                      fontFamily: '"BMKkubulim", sans-serif',
                      fontSize: 'clamp(36px, 10.5vw, 60px)',
                      letterSpacing: '-1px',
                    }}
                  >AI 오디션</span>
                </div>

                {/* ── 설명 텍스트 ── */}
                <div className="absolute z-10" style={{ top: '68%', left: '6%', right: '6%' }}>
                  <p
                    className="text-white/50 leading-snug"
                    style={{ fontFamily: '"Pretendard", sans-serif', fontSize: 'clamp(11px, 2.8vw, 13px)', fontWeight: 500 }}
                  >
                    {usageCounts === null ? "..." : `${formatCount(usageCounts["audition"] ?? 0)}명 참여`} · 성향 퀴즈 · 표정 연기<br />
                    <span className="text-white/30">AI 감독이 당신을 심사합니다</span>
                  </p>
                </div>

                {/* ── 바텀 바: 유저 수 + 크레딧 + 화살표 ── */}
                <div className="absolute z-20 flex items-center justify-between" style={{ bottom: '6%', left: '6%', right: '6%' }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1.5 text-white/40 border border-white/10 rounded-full px-2.5 py-1"
                      style={{ fontFamily: '"Pretendard", sans-serif', fontSize: 'clamp(10px, 2.5vw, 12px)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3.2" fill="currentColor" fillOpacity="0.8"/>
                        <path d="M1 15c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      {usageCounts === null ? "..." : `${formatCount(usageCounts["audition"] ?? 0)}명 참여`}
                    </span>
                    <span
                      className="text-[#C9571A] border border-[#C9571A]/40 rounded-full px-2.5 py-1 font-bold"
                      style={{ fontFamily: '"Unbounded", sans-serif', fontSize: 'clamp(9px, 2.2vw, 11px)' }}
                    >5 Credits</span>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-[#C9571A] flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* ── 오렌지 수직선 장식 (우측) ── */}
                <div className="absolute right-6 z-10" style={{ top: '28%', bottom: '20%', width: '1.5px', background: 'linear-gradient(to bottom, transparent, rgba(201,87,26,0.5), transparent)' }} />

                    </div>
                  </Link>
                )}

                {showPersonalColorLab && (
                  <button
                    type="button"
                    onClick={handlePersonalColorClick}
                    className="block w-full mb-4 text-left active:scale-[0.97] transition-transform"
                  >
                    <div
                      className="relative overflow-hidden rounded-2xl border border-[#DDE4F0]/10 bg-[#0C1018]"
                      style={{ aspectRatio: "4/3" }}
                    >
                    <div
                      className="absolute inset-0 z-0"
                      style={{
                        background: "radial-gradient(circle at 18% 18%, rgba(255,140,118,0.24) 0%, transparent 34%), radial-gradient(circle at 85% 18%, rgba(106,139,255,0.20) 0%, transparent 38%), linear-gradient(160deg, rgba(11,16,26,1) 0%, rgba(17,22,36,1) 100%)",
                      }}
                    />
                    <span
                      className="absolute select-none z-[1] font-unbounded font-black"
                      style={{
                        bottom: "-2%",
                        right: "-4%",
                        fontSize: "clamp(54px, 16vw, 92px)",
                        lineHeight: 1,
                        letterSpacing: "-4px",
                        color: "rgba(255,255,255,0.035)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      COLOR
                    </span>

                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-5">
                      <span
                        className="font-unbounded font-medium tracking-[0.18em] uppercase text-[#8DAEFF]"
                        style={{ fontSize: "clamp(9px, 2.4vw, 11px)" }}
                      >
                        AI Personal Color
                      </span>
                    <span
                        className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white/35 uppercase"
                        style={{ fontFamily: '"Unbounded", sans-serif' }}
                      >
                        {isPersonalColorEnabled ? "FREE" : "PAUSED"}
                      </span>
                    </div>

                    <div className="absolute z-10 flex flex-col" style={{ top: "24%", left: "6%", right: "12%" }}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="h-[2px] w-6 bg-[#8DAEFF]" />
                        <span
                          className="font-unbounded text-white/42 uppercase tracking-[0.08em]"
                          style={{ fontSize: "clamp(10px, 2.6vw, 13px)" }}
                        >
                          Tone Lab
                        </span>
                      </div>
                      <span
                        className="leading-[0.92] text-white"
                        style={{
                          fontFamily: '"BMKkubulim", sans-serif',
                          fontSize: "clamp(36px, 10.5vw, 60px)",
                          letterSpacing: "-1px",
                        }}
                      >
                        퍼스널 컬러
                      </span>
                    </div>

                    <div className="absolute z-10" style={{ top: "65%", left: "6%", right: "6%" }}>
                      <p
                        className="leading-snug text-white/58"
                        style={{ fontFamily: '"Pretendard", sans-serif', fontSize: "clamp(11px, 2.8vw, 13px)", fontWeight: 500 }}
                      >
                        셀카 한 장으로 웜/쿨, 밝기, 선명도를 추정하고
                        <br />
                        <span className="text-white/34">지금 얼굴에 잘 맞는 StyleDrop 필터까지 바로 추천해드려요</span>
                      </p>
                    </div>

                    <div className="absolute z-20 flex items-center justify-between" style={{ bottom: "6%", left: "6%", right: "6%" }}>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full border border-white/10 px-2.5 py-1 text-white/45"
                          style={{ fontFamily: '"Pretendard", sans-serif', fontSize: "clamp(10px, 2.5vw, 12px)" }}
                        >
                          {usageCounts === null ? "..." : `${formatCount(usageCounts["personal_color"] ?? 0)}명 참여`}
                        </span>
                        <span
                          className="rounded-full border border-[#8DAEFF]/40 px-2.5 py-1 font-bold text-[#8DAEFF]"
                          style={{ fontFamily: '"Unbounded", sans-serif', fontSize: "clamp(9px, 2.2vw, 11px)" }}
                        >
                          LIVE LAB
                        </span>
                      </div>

                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#8DAEFF]">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="#0C1018" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>

                    {!isPersonalColorEnabled && (
                      <>
                        <div className="absolute inset-0 bg-[#07101C]/62" />
                        <div className="absolute inset-0 z-30 flex items-center justify-center">
                          <span className="rounded-full border border-white/18 bg-black/35 px-4 py-2 text-[13px] font-bold text-white backdrop-blur-md">
                            현재 점검 중
                          </span>
                        </div>
                      </>
                    )}
                    </div>
                  </button>
                )}

              </div>
            </>
          )}
        </main>

        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* 비로그인 배너 */}
        {!loading && !user && (
          <div className="max-w-2xl mx-auto w-full px-4 pb-4">
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl px-5 py-4 flex flex-col gap-3">
              <p className="text-white/80 text-[14px] font-medium">✦ 카카오 로그인하면 3크레딧 무료 지급!</p>
              <p className="text-[12px] text-[#666]">1크레딧 = AI 변환 1회 · 워터마크 없이 고화질 저장</p>
              <button
                onClick={() => { setLoginLoading(true); login(); }}
                disabled={loginLoading}
                className="bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold py-3 w-full text-[15px] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loginLoading ? (
                  <span className="w-5 h-5 rounded-full border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E]" style={{ animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
                  </svg>
                )}
                {loginLoading ? "연결 중..." : "카카오로 로그인하기"}
              </button>
            </div>
          </div>
        )}


        {/* Footer */}
        <footer className="py-6 text-center px-4">
          <p className="text-[11px] text-[#333]">
            © 2026 StyleDrop v2.0 · <Link href="/terms" className="hover:text-white/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-white/30 transition-colors">개인정보처리방침</Link>
          </p>
          <p className="text-[10px] text-[#2a2a2a] mt-1 leading-relaxed">
            상호: 핑거 · 대표자: 문지환 · 사업자등록번호: 707-79-00261<br/>
            주소: 서울특별시 송파구 오금로 551, 1동 2층 201호 257 · 연락처: 0505-007-3670
          </p>
        </footer>
      </div>

      {showShowcaseJoinModal && (
        <div
          className="fixed inset-0 z-[55] bg-black/75"
          onClick={() => {
            if (showcaseSubmitting) return;
            setShowShowcaseJoinModal(false);
          }}
        >
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-[28px] border border-white/10 bg-[#111] px-5 pt-5 pb-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10" />
            <p className="text-[18px] font-black text-white">나도 추가하기</p>
            <p className="mt-1 text-[13px] leading-6 text-white/45">
              최근 결과물 중 한 장을 고르고, 인스타 아이디를 남길 수 있어요.
            </p>

            <div className="mt-5">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white/38">Result Photo</p>
              {showcaseHistoryLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : showcaseHistory.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-[13px] leading-6 text-white/45">
                  최근 24시간 내 결과물이 없어요.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {showcaseHistory.map((item) => {
                    const selected = selectedShowcaseHistoryId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedShowcaseHistoryId(item.id)}
                        className={`overflow-hidden rounded-[18px] border text-left transition-colors ${
                          selected ? "border-[#C9571A] bg-[#C9571A]/8" : "border-white/8 bg-white/[0.03]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.result_image_url} alt={STYLE_LABELS[item.style_id] ?? item.style_id} className="aspect-square w-full object-cover" />
                        <div className="px-2.5 py-2.5">
                          <p className="line-clamp-1 text-[11px] font-semibold text-white/80">
                            {STYLE_LABELS[item.style_id] ?? item.style_id}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="showcase-instagram" className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/38">
                  Instagram ID
                </label>
                {showcaseInstagram && (
                  <span className="text-[11px] text-[#6BE2C5]/70">프로필에서 자동 불러옴</span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-white/30 select-none">@</span>
                <input
                  id="showcase-instagram"
                  type="text"
                  value={showcaseInstagram.replace(/^@/, "")}
                  onChange={(event) => setShowcaseInstagram(event.target.value.replace(/^@+/, ""))}
                  placeholder="instagram_id"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-8 pr-4 py-3 text-[14px] text-white outline-none placeholder:text-white/22 focus:border-[#C9571A]/60"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowShowcaseJoinModal(false)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] font-bold text-white/60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitShowcaseJoin}
                disabled={showcaseSubmitting || !selectedShowcaseHistoryId}
                className="flex-1 rounded-2xl bg-[#C9571A] px-4 py-3 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {showcaseSubmitting ? "추가 중..." : "메인에 추가하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 베리에이션 선택 모달 (카드 클릭 직후 — 파일 선택 전) */}
      {variantSelectStyle && (() => {
        const variants = STYLE_VARIANTS[variantSelectStyle.id] ?? [];
        return (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => { setVariantSelectStyle(null); setSelectedStyle(null); }}
          >
            <div
              className="bg-[#111] border border-white/10 rounded-t-3xl w-full max-w-2xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
              <p className="text-white font-bold text-[18px] mb-1">스타일 옵션 선택</p>
              <p className="text-[#555] text-[13px] mb-5">{variantSelectStyle.name} — 원하는 분위기를 골라주세요</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      sessionStorage.setItem("sd_variant", v.id);
                      setVariantSelectStyle(null);
                      uploadTargetRef.current = { mode: "single" };
                      setShowPhotoSourceSheet(true);
                    }}
                    className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-[#C9571A]/50 rounded-2xl overflow-hidden transition-all text-left flex flex-col"
                  >
                    {v.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail}
                        alt={v.label}
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                        <span className="text-white/10 text-4xl">✦</span>
                      </div>
                    )}
                    <div className="px-4 py-3">
                      <p className="text-white font-bold text-[14px]">{v.label}</p>
                      {v.desc && <p className="text-[#555] text-[11px] mt-0.5 break-keep">{v.desc}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setVariantSelectStyle(null); setSelectedStyle(null); }}
                className="w-full py-2 text-[#444] hover:text-white text-[13px] transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        );
      })()}

      {pairUploadStyle && (
        <div
          className="fixed inset-0 z-[58] bg-black/70 flex items-end justify-center"
          onClick={() => {
            setPairUploadStyle(null);
            setPairUploadImages([null, null]);
            setSelectedStyle(null);
            uploadTargetRef.current = null;
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        >
          <div
            className="w-full max-w-2xl bg-[#111214] rounded-t-3xl px-4 pt-2 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-5" />
            <p className="text-[13px] font-semibold text-white/40 text-center mb-1">2장 업로드 전용</p>
            <p className="text-[22px] font-black tracking-[-0.04em] text-white text-center">{pairUploadStyle.name}</p>
            <div className="mt-3 text-center">
              <p className="text-[16px] font-bold leading-6 tracking-[-0.02em] text-white">
                서로 다른 두 사람 사진을 각각 1장씩 올려주세요.
              </p>
              <p className="mt-1 text-[14px] font-medium leading-6 text-white/72">
                얼굴이 정면에 가깝고 또렷하게 보일수록 정확도가 좋습니다.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {([0, 1] as const).map((slotIndex) => {
                const image = pairUploadImages[slotIndex];
                return (
                  <div key={slotIndex} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[13px] font-bold text-white">인물 {slotIndex + 1}</p>
                      {image && (
                        <button
                          type="button"
                          onClick={() => {
                            setPairUploadImages((prev) => {
                              const next: [string | null, string | null] = [...prev] as [string | null, string | null];
                              next[slotIndex] = null;
                              return next;
                            });
                          }}
                          className="text-[12px] text-white/38"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="aspect-[4/5] overflow-hidden rounded-[20px] bg-black/30">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={`인물 ${slotIndex + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-4 text-center text-[12px] leading-5 text-white/28">
                          얼굴이 잘 보이는
                          <br />
                          사진을 올려주세요
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          uploadTargetRef.current = { mode: "pair", slotIndex };
                          fileInputRef.current?.click();
                        }}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[13px] font-bold text-white"
                      >
                        앨범
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          uploadTargetRef.current = { mode: "pair", slotIndex };
                          setShowCameraGuide(true);
                        }}
                        className="rounded-2xl border border-[#C9571A]/30 bg-[#C9571A]/10 px-3 py-3 text-[13px] font-bold text-[#F6B38C]"
                      >
                        촬영
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPairUploadStyle(null);
                  setPairUploadImages([null, null]);
                  setSelectedStyle(null);
                  uploadTargetRef.current = null;
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-[14px] font-bold text-white/55"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleGeneratePairUpload()}
                disabled={pairSubmitting || !pairUploadImages[0] || !pairUploadImages[1]}
                className="flex-[1.4] rounded-2xl bg-[#C9571A] px-4 py-4 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {pairSubmitting ? "준비 중..." : "이 두 장으로 생성하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카메라 가이드 모달 */}
      {/* 촬영 / 앨범 선택 시트 */}
      {showPhotoSourceSheet && (
        <div
          className="fixed inset-0 z-[58] bg-black/60 flex items-end justify-center"
          onClick={() => {
            setShowPhotoSourceSheet(false);
            uploadTargetRef.current = null;
          }}
        >
          <div
            className="w-full max-w-2xl bg-[#1C1C1E] rounded-t-3xl px-4 pt-2 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-5" />
            <p className="text-[13px] font-semibold text-white/40 text-center mb-4">사진 선택</p>
            <div className="flex flex-col gap-2 mb-3">
              <button
                onClick={() => {
                  uploadTargetRef.current = { mode: "single" };
                  setShowPhotoSourceSheet(false);
                  setShowCameraGuide(true);
                }}
                className="w-full flex items-center gap-4 bg-white/[0.06] hover:bg-white/10 rounded-2xl px-5 py-4 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#C9571A]/20 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#C9571A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="13" r="4" stroke="#C9571A" strokeWidth="1.8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">실시간 촬영</p>
                  <p className="text-[12px] text-white/40 mt-0.5">카메라로 바로 찍기</p>
                </div>
              </button>
              <button
                onClick={() => {
                  uploadTargetRef.current = { mode: "single" };
                  setShowPhotoSourceSheet(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-4 bg-white/[0.06] hover:bg-white/10 rounded-2xl px-5 py-4 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8"/>
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8"/>
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8"/>
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">앨범에서 선택</p>
                  <p className="text-[12px] text-white/40 mt-0.5">갤러리에서 사진 가져오기</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => {
                setShowPhotoSourceSheet(false);
                uploadTargetRef.current = null;
              }}
              className="w-full py-3.5 rounded-2xl bg-white/[0.04] text-[15px] font-semibold text-white/50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {showHowToModal && (
        <HowToFlow
          mode="modal"
          onClose={() => setShowHowToModal(false)}
          onComplete={({ hideForFuture }) => {
            if (hideForFuture) {
              writeHowToHiddenPreference(user?.id ?? null, true);
            }
            setShowHowToModal(false);
          }}
        />
      )}

      {showCameraGuide && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">
          {/* 상단 */}
          <div className="flex items-center justify-between px-5 pt-12 pb-4">
            <button onClick={stopCamera} className="text-white/60 text-[14px]">취소</button>
            <p className="text-white font-bold text-[15px]">셀카 찍기</p>
            <div className="w-12" />
          </div>

          {/* 카메라 뷰 + 오버레이 */}
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* 얼굴 가이드 오버레이 */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              <defs>
                <mask id="face-mask">
                  <rect width="100" height="100" fill="white"/>
                  <ellipse cx="50" cy="44" rx="28" ry="36" fill="black"/>
                </mask>
              </defs>
              <rect width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#face-mask)"/>
              <ellipse cx="50" cy="44" rx="28" ry="36" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.9"/>
            </svg>
            {/* 안내 문구 */}
            <div className="absolute bottom-6 left-0 right-0 text-center">
              <p className="text-white/80 text-[13px] font-medium drop-shadow-lg">얼굴을 타원 안에 맞춰주세요</p>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="pb-14 pt-6 flex flex-col items-center gap-4 bg-black">
            {/* 촬영 버튼 */}
            <button
              onClick={captureFromCamera}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 active:scale-95 transition-transform shadow-2xl"
            />
            {/* 앨범에서 선택 */}
            <button
              onClick={() => { stopCamera(); fileInputRef.current?.click(); }}
              className="text-white/50 text-[13px]"
            >
              앨범에서 선택
            </button>
          </div>
        </div>
      )}

      {/* 로그인 유도 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowLoginModal(false)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm mx-4 border border-[#333] text-center w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[40px]">🎁</p>
            <p className="text-[18px] font-bold text-white mt-3">무료 체험이 끝났어요</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">카카오 로그인하면<br/><span className="text-[#C9571A] font-bold">3크레딧을 무료로 받아요!</span><br/>1크레딧 = AI 변환 1회</p>
            <button
              onClick={() => { window.location.href = "/api/auth/kakao"; }}
              className="bg-[#FEE500] text-[#3C1E1E] font-bold text-[15px] w-full py-4 rounded-xl mt-4 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
              </svg>
              카카오로 로그인하고 3크레딧 받기
            </button>
            <button onClick={() => setShowLoginModal(false)} className="text-[13px] text-[#555] mt-3 hover:text-[#888] transition-colors">
              다음에 할게요
            </button>
          </div>
        </div>
      )}

      {showNoCreditModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowNoCreditModal(false)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm mx-4 border border-[#333] text-center w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[40px]">💳</p>
            <p className="text-[18px] font-bold text-white mt-3">크레딧이 없어요</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">1회 변환에 1크레딧이 필요해요.<br/>크레딧을 충전하고 계속 이용해보세요.</p>
            <Link
              href="/shop"
              className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold text-[15px] w-full py-4 rounded-xl mt-4 flex items-center justify-center transition-colors"
            >
              크레딧 충전하기
            </Link>
            <button onClick={() => setShowNoCreditModal(false)} className="text-[13px] text-[#555] mt-3 hover:text-[#888] transition-colors">
              나중에 할게요
            </button>
          </div>
        </div>
      )}

      {activeShowcase && (
        <div
          className="fixed inset-0 z-[70] bg-black"
          onClick={closeStoryViewer}
        >
          <div
            className="relative h-full w-full overflow-hidden bg-black text-white sm:mx-auto sm:max-w-[430px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[max(env(safe-area-inset-top),12px)]">
              <div className="flex items-center gap-1.5">
                {showcaseItems.map((item, index) => {
                  const isPast = selectedShowcaseIndex !== null && index < selectedShowcaseIndex;
                  const isCurrent = index === selectedShowcaseIndex;
                  return (
                    <div key={`${item.userId}-${item.createdAt}`} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                      <div
                        key={isCurrent ? `${item.userId}-${item.createdAt}-active` : `${item.userId}-${item.createdAt}-idle`}
                        className="h-full rounded-full bg-white origin-left will-change-transform [backface-visibility:hidden]"
                        style={{
                          transform: isPast ? "scaleX(1)" : "scaleX(0)",
                          animation: isCurrent ? `story-progress-fill ${STORY_DURATION_MS}ms linear forwards` : "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="rounded-full bg-[linear-gradient(135deg,#C9571A,#F6B38C,#C9571A)] p-[2px]">
                    <div className="rounded-full bg-black p-[2px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeShowcase.imageUrl}
                        alt={activeShowcase.nickname}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-[14px] font-semibold text-white">{showcaseDisplayName(activeShowcase)}님</p>
                    <p className="text-[11px] text-white/65">{formatStoryTime(activeShowcase.createdAt)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeStoryViewer}
                  className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-[22px] font-light text-white backdrop-blur-sm"
                  aria-label="스토리 닫기"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="absolute inset-0 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeShowcase.imageUrl}
                alt={activeShowcase.nickname}
                className="h-full w-full object-contain"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.08)_28%,rgba(0,0,0,0.16)_62%,rgba(0,0,0,0.72)_100%)]" />
            </div>

            <button
              type="button"
              onClick={openPreviousStory}
              className="absolute inset-y-0 left-0 z-10 w-1/3"
              aria-label="이전 스토리"
            />
            <button
              type="button"
              onClick={openNextStory}
              className="absolute inset-y-0 right-0 z-10 w-1/3"
              aria-label="다음 스토리"
            />

            <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[24px] font-black tracking-[-0.04em] text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                    {showcaseDisplayName(activeShowcase)}님
                  </p>
                  <p className="mt-1 text-[13px] text-white/72">
                    공개 결과 스토리
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleStoryLike}
                  className={`relative z-20 flex shrink-0 flex-col items-center justify-center gap-0.5 h-14 w-12 rounded-2xl border backdrop-blur-sm transition-colors ${
                    activeShowcaseLiked
                      ? "border-[#C9571A]/60 bg-[#C9571A]/18 text-[#FF8B60]"
                      : "border-white/14 bg-black/28 text-white"
                  }`}
                  aria-label="스토리 좋아요"
                >
                  <span className="text-[20px] leading-none">{activeShowcaseLiked ? "♥" : "♡"}</span>
                  {activeShowcase.likeCount > 0 && (
                    <span className="text-[10px] font-bold tabular-nums leading-none">
                      {activeShowcase.likeCount >= 1000
                        ? `${(activeShowcase.likeCount / 1000).toFixed(1)}k`
                        : activeShowcase.likeCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeStoryViewer();
                  router.push("/studio");
                }}
                className="relative z-20 w-full rounded-full bg-[#C9571A] px-4 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#B34A12]"
              >
                나도 결과 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImagePreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4" onClick={closeImageConfirm}>
          <div
            className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#111] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-unbounded text-[10px] tracking-[0.18em] text-[#C9571A] uppercase">Photo Check</p>
            <p className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">이 사진으로 진행할까요?</p>
            <p className="mt-2 text-[13px] leading-6 text-white/50">
              확인을 누르면 바로 AI 변환으로 넘어갑니다.
            </p>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12px] font-bold text-white/72">프레임 안에서 위치를 맞춰주세요</p>
                <span className="text-[11px] text-white/38">확대 · 이동 가능</span>
              </div>
              <div
                ref={cropFrameRef}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
                onTouchStart={handleCropTouchStart}
                onTouchMove={handleCropTouchMove}
                onTouchEnd={handleCropTouchEnd}
                onTouchCancel={handleCropTouchEnd}
                className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#1A1A1A] touch-none"
                style={{ userSelect: "none" }}
              >
                {pendingImagePreview && cropState && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingImagePreview}
                      alt="선택한 사진 미리보기"
                      draggable={false}
                      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                      style={{
                        width: cropState.imageWidth * cropState.baseScale * cropState.zoom,
                        height: cropState.imageHeight * cropState.baseScale * cropState.zoom,
                        transform: `translate(calc(-50% + ${cropState.offsetX}px), calc(-50% + ${cropState.offsetY}px))`,
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 border border-white/15" />
                    <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <mask id="crop-face-mask">
                          <rect width="100" height="100" fill="white" />
                          <ellipse cx="50" cy="47" rx="26" ry="33" fill="black" />
                        </mask>
                      </defs>
                      <rect width="100" height="100" fill="rgba(0,0,0,0.2)" mask="url(#crop-face-mask)" />
                      <ellipse
                        cx="50"
                        cy="47"
                        rx="26"
                        ry="33"
                        fill="none"
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth="0.6"
                        strokeDasharray="3 2"
                      />
                    </svg>
                  </>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/34">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={2.6}
                  step={0.01}
                  value={cropState?.zoom ?? 1}
                  onChange={(event) => {
                    const nextZoom = Number(event.target.value);
                    setCropState((prev) => prev ? clampCropOffsets({ ...prev, zoom: nextZoom }) : prev);
                  }}
                  className="h-2 flex-1 cursor-pointer accent-[#C9571A]"
                />
                <button
                  type="button"
                  onClick={resetCropState}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:text-white"
                >
                  초기화
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeImageConfirm}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] font-bold text-white/70 transition-colors hover:text-white"
              >
                다시 고르기
              </button>
              <button
                type="button"
                onClick={handleConfirmSelectedImage}
                className="rounded-2xl bg-[#C9571A] px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#B34A12]"
              >
                이 사진으로 진행
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
