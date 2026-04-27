"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAuditionAvailability } from "@/hooks/useAuditionAvailability";
import { getGuestHistory, type GuestHistoryItem } from "@/lib/guest-history";
import { buildKakaoLoginUrlWithReferral, buildReferralShareUrl } from "@/lib/referral";
import { MULTI_SOURCE_STYLE_IDS, STYLE_LABELS, VISIBLE_STYLE_IDS } from "@/lib/styles";
import { STYLE_VARIANTS } from "@/lib/variants";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type HistoryItem = {
  id: string;
  style_id: string;
  variant?: string;
  result_image_url: string;
  before_image_url?: string | null;
  created_at: string;
};

type AuditionHistoryItem = {
  id: string;
  share_id: string;
  avg_score: number;
  assigned_role: string;
  still_image_url: string | null;
  created_at: string;
};

type TravelHistoryItem = {
  roomId: string;
  relation: "friend" | "lover" | "family" | "coworker";
  myName: string;
  partnerName: string;
  participantToken: string;
  completedAt: string;
  unlocked: boolean;
};

type NaboPredictHistoryItem = {
  sessionId: string;
  ownerName: string;
  targetName: string;
  relationshipType: string;
  createdAt: number;
  completedAt: number | null;
  status: "waiting" | "completed";
  role: "owner" | "respondent";
  href: string;
};

type ShowcaseState = {
  imageUrl: string;
  styleId: string | null;
  createdAt: string;
} | null;

type ReferralSummary = {
  qualifiedCount: number;
  remainingForNextReward: number;
  monthlyRewardCredits: number;
  monthlyRewardCap: number;
  generationThreshold: number;
  generationRewardCredits: number;
  paymentRewardCredits: number;
  referredPaymentBonusCredits: number;
};

const MULTI_SOURCE_STYLE_ID_SET = new Set<string>(MULTI_SOURCE_STYLE_IDS);
const TRAVEL_RELATION_LABELS: Record<TravelHistoryItem["relation"], string> = {
  friend: "친한 친구",
  lover: "연인",
  family: "가족",
  coworker: "직장 동료",
};

interface KakaoSDK {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (options: Record<string, unknown>) => void };
}

function HistoryPreview({
  item,
  historyView,
  isActive,
}: {
  item: HistoryItem;
  historyView: "before" | "after";
  isActive: boolean;
}) {
  const isSplitBefore =
    historyView === "before" &&
    Boolean(item.before_image_url) &&
    MULTI_SOURCE_STYLE_ID_SET.has(item.style_id);

  if (isSplitBefore && item.before_image_url) {
    return (
      <div
        className={`relative w-full aspect-square rounded-2xl overflow-hidden bg-[#F0F0F0] transition-opacity duration-300 ${
          isActive ? "opacity-100" : "opacity-50"
        }`}
      >
        <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.before_image_url}
            alt=""
            className="h-full w-[200%] max-w-none object-cover object-left"
          />
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.before_image_url}
            alt=""
            className="h-full w-[200%] max-w-none object-cover object-right"
          />
        </div>
        <div className="pointer-events-none absolute inset-y-[8%] left-1/2 z-[1] w-px -translate-x-1/2 bg-white/18 shadow-[0_0_18px_rgba(255,255,255,0.18)]" />
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={historyView === "before" && item.before_image_url ? item.before_image_url : item.result_image_url}
        alt=""
        className={`w-full aspect-square rounded-2xl object-cover bg-[#F0F0F0] transition-opacity duration-300 ${
          isActive ? "opacity-100" : "opacity-50"
        }`}
      />
    </>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "방금 전" : `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "어제" : `${days}일 전`;
}

function expiryBadge(iso: string): { label: string; className: string } {
  const msLeft = new Date(iso).getTime() + 24 * 3600000 - Date.now();
  const totalMins = Math.max(0, Math.floor(msLeft / 60000));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const label = hours > 0 ? `${hours}시간 ${mins}분 뒤 삭제` : `${mins}분 뒤 삭제`;
  if (msLeft < 3 * 3600000) return { label, className: "bg-red-50 text-red-600 border-red-100" };
  if (msLeft < 12 * 3600000) return { label, className: "bg-amber-50 text-amber-700 border-amber-100" };
  return { label, className: "bg-[#F4F4F4] text-[#777] border-[#E7E7E7]" };
}

function categoryExpiry(items: { created_at: string }[]): { label: string; className: string } | null {
  if (items.length === 0) return null;
  const oldest = items.reduce((a, b) => a.created_at < b.created_at ? a : b);
  return expiryBadge(oldest.created_at);
}

export default function MyPage() {
  const { user, loading, logout } = useAuth();
  const { isVisible: isAuditionVisible, isEnabled: isAuditionEnabled } = useAuditionAvailability();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [guestHistory, setGuestHistory] = useState<GuestHistoryItem[]>([]);
  const [auditionHistory, setAuditionHistory] = useState<AuditionHistoryItem[]>([]);
  const [travelHistory, setTravelHistory] = useState<TravelHistoryItem[]>([]);
  const [naboPredictHistory, setNaboPredictHistory] = useState<NaboPredictHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [historyDeleteTarget, setHistoryDeleteTarget] = useState<HistoryItem | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [giftStatus, setGiftStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [giftMsg, setGiftMsg] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<"cards" | "lab">("cards");
  const [activeIndex, setActiveIndex] = useState(0);
  const [historyView, setHistoryView] = useState<"before" | "after">("after");
  const [toast, setToast] = useState<string | null>(null);
  const [instaHandle, setInstaHandle] = useState<string>("");
  const [instaInput, setInstaInput] = useState<string>("");
  const [instaEditing, setInstaEditing] = useState(false);
  const [instaSaving, setInstaSaving] = useState(false);
  const [showcaseUploading, setShowcaseUploading] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showcaseState, setShowcaseState] = useState<ShowcaseState>(null);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const showAuditionHistory = isAuditionVisible && isAuditionEnabled;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setGuestHistory(getGuestHistory());
      setTravelHistory([]);
      setNaboPredictHistory([]);
      setHistoryLoading(false);
      return;
    }
    const requests: Promise<void>[] = [
      fetch("/api/history").then(r => r.json()).then(d => setHistory(d.history ?? [])).catch(() => {}),
      fetch("/api/travel-together/history").then(r => r.json()).then(d => setTravelHistory(d.history ?? [])).catch(() => {}),
      fetch("/api/nabo-predict/history").then(r => r.json()).then(d => setNaboPredictHistory(d.history ?? [])).catch(() => {}),
    ];
    if (showAuditionHistory) {
      requests.push(
        fetch("/api/audition/history").then(r => r.json()).then(d => setAuditionHistory(d.history ?? [])).catch(() => {})
      );
    }
    Promise.all(requests).finally(() => setHistoryLoading(false));
    fetch("/api/credits")
      .then(r => r.json())
      .then(d => setCredits(d.credits ?? 0))
      .catch(() => {});
    fetch("/api/public-showcase", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setShowcaseState(data?.me?.imageUrl ? data.me : null))
      .catch(() => {});
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const h = data?.instagram_handle ?? "";
        setInstaHandle(h);
        setInstaInput(h);
      })
      .catch(() => {});
    fetch("/api/referrals/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setReferralSummary(data.error ? null : data))
      .catch(() => {});
  }, [user, loading, showAuditionHistory]);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsStandalone(true);
      showToast("홈 화면에 추가됐어요.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [showToast]);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (res.ok) window.location.href = "/";
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  const handleRedeemGift = async () => {
    if (!giftInput.trim()) return;
    setGiftStatus("loading");
    try {
      const res = await fetch("/api/gift/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: giftInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGiftMsg(data.error ?? "코드 사용 실패");
        setGiftStatus("error");
      } else {
        setGiftMsg(`크레딧 ${data.credits}회가 지급됐어요!`);
        setGiftStatus("success");
        setGiftInput("");
        setCredits((prev) => (prev ?? 0) + data.credits);
      }
    } catch {
      setGiftMsg("오류가 발생했어요.");
      setGiftStatus("error");
    }
  };

  const handleCopyReferralLink = async () => {
    if (!user) return;
    const link = buildReferralShareUrl(`${window.location.origin}/`, user.referralCode ?? user.id);
    try {
      await navigator.clipboard.writeText(link);
      showToast("초대 링크가 복사됐어요.");
    } catch {
      showToast("링크 복사에 실패했어요.");
    }
  };

  const handleSaveInsta = async () => {
    setInstaSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram_handle: instaInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "저장에 실패했어요.");
      } else {
        const saved = data.instagram_handle ?? "";
        setInstaHandle(saved);
        setInstaInput(saved);
        setInstaEditing(false);
        showToast(saved ? "인스타그램 아이디가 저장됐어요." : "인스타그램 아이디를 삭제했어요.");
      }
    } catch {
      showToast("저장에 실패했어요.");
    } finally {
      setInstaSaving(false);
    }
  };

  const handleSave = async (url: string) => {
    try {
      const blob = await (await fetch(url)).blob();
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        const file = new File([blob], "styledrop.jpg", { type: "image/jpeg" });
        await navigator.share({ files: [file] });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "styledrop.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch { showToast("저장에 실패했어요."); }
  };

  const handleKakaoShare = (imgUrl: string) => {
    const kakao = (window as Window & { Kakao?: KakaoSDK }).Kakao;
    if (!kakao) { showToast("카카오 SDK 로딩 중이에요."); return; }
    if (!kakao.isInitialized()) kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);
    const link = window.location.origin + "/studio";
    kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "AI가 바꿔준 내 사진",
        description: "StyleDrop으로 변환했어요",
        imageUrl: imgUrl,
        link: { mobileWebUrl: link, webUrl: link },
      },
    });
  };

  const handleInstallApp = async () => {
    if (isStandalone) {
      showToast("이미 홈 화면에서 앱처럼 실행 중이에요.");
      return;
    }

    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      setDeferredInstallPrompt(null);
      if (choice?.outcome === "accepted") {
        showToast("홈 화면에 추가하는 중이에요.");
      }
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    router.push(isIOS ? "/install-app#ios" : "/install-app#android");
  };

  const handleHideFromHome = async () => {
    try {
      const res = await fetch("/api/public-showcase", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setShowcaseState(null);
      showToast("메인 스토리에서 내렸어요.");
    } catch {
      showToast("공개 해제에 실패했어요.");
    }
  };

  const handlePostToShowcase = async () => {
    const item = selectedItems[activeIndex];
    if (!item) return;
    setShowcaseUploading(true);
    try {
      const imgRes = await fetch(item.result_image_url);
      const blob = await imgRes.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/public-showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          styleId: item.style_id,
          variant: item.variant ?? "default",
          instagramHandle: instaHandle || null,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setShowcaseState({ imageUrl: data.imageUrl, styleId: item.style_id, createdAt: new Date().toISOString() });
      showToast(instaHandle ? `메인 스토리에 올렸어요 · @${instaHandle} 포함` : "메인 스토리에 올렸어요.");
    } catch {
      showToast("올리기에 실패했어요.");
    } finally {
      setShowcaseUploading(false);
    }
  };

  // 스타일별 그룹핑 (history가 없어도 STYLE_ORDER 전체 표시)
  const grouped = VISIBLE_STYLE_IDS.reduce<Record<string, HistoryItem[]>>((acc, id) => {
    acc[id] = history.filter(h => h.style_id === id);
    return acc;
  }, {});

  const selectedItems = selectedStyle ? (grouped[selectedStyle] ?? []) : [];

  useEffect(() => {
    setActiveIndex(0);
    setHistoryView("after");
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [selectedStyle]);

  useEffect(() => {
    setHistoryView("after");
  }, [activeIndex]);

  // 스크롤 시 현재 활성 인덱스 감지
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.clientWidth;
    const idx = Math.round(el.scrollLeft / itemWidth);
    setActiveIndex(Math.min(idx, selectedItems.length - 1));
  }, [selectedItems.length]);

  const handleDeleteHistoryItem = async () => {
    if (!historyDeleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/history?id=${historyDeleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");

      setHistory((prev) => prev.filter((item) => item.id !== historyDeleteTarget.id));
      setHistoryDeleteTarget(null);
      showToast("변환 기록을 삭제했어요.");

      const remainingInStyle = selectedItems.filter((item) => item.id !== historyDeleteTarget.id);
      if (remainingInStyle.length === 0) {
        setSelectedStyle(null);
      } else if (activeIndex >= remainingInStyle.length) {
        setActiveIndex(Math.max(0, remainingInStyle.length - 1));
      }
    } catch {
      showToast("삭제에 실패했어요.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex flex-col">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#F0F0F0] backdrop-blur-xl text-[#0A0A0A] text-sm px-6 py-3 rounded-2xl border border-[#E8E8E8] shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="h-[52px] bg-white border-b border-[#F0F0F0] flex items-center justify-between px-4 sticky top-0 z-40">
        {selectedStyle ? (
          <button onClick={() => setSelectedStyle(null)} className="flex items-center gap-1.5 text-[#0A0A0A]/50 hover:text-[#0A0A0A] transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[#0A0A0A]/50 hover:text-[#0A0A0A] transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        <div className="w-8" />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-12 flex flex-col gap-6">

        {/* 비로그인 */}
        {!loading && !user && (
          <div className="flex flex-col gap-5">
            <div className="bg-orange-50 border border-[#C9571A]/30 rounded-2xl px-4 py-3.5 flex flex-col gap-3">
              <p className="text-[13px] text-[#C9571A]/90 font-medium leading-relaxed">
                현재 기록은 이 브라우저에만 임시 보관됩니다.<br />
                영구 저장하려면 카카오 로그인을 해주세요!
              </p>
              <button
                onClick={() => { window.location.href = buildKakaoLoginUrlWithReferral(); }}
                className="bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold py-2.5 w-full text-[14px] flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
                </svg>
                카카오로 로그인하기
              </button>
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-[#E8E8E8] border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : guestHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-[#0A0A0A]/40 text-[15px]">아직 변환 기록이 없어요.<br />스타일을 적용해보세요!</p>
                <button onClick={() => router.push("/studio")} className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold px-6 py-3 rounded-xl transition-colors">
                  스타일 적용하러 가기
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-[#666] mb-3 px-1">임시 변환 기록 · 이 기기에만 보관</p>
                <div className="grid grid-cols-3 gap-2">
                  {guestHistory.map(item => (
                    <button key={item.id} onClick={() => window.open(item.result_image_url, "_blank")} className="flex flex-col gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.result_image_url} alt="" className="w-full aspect-square rounded-xl object-cover bg-[#F0F0F0]" />
                      <span className="text-[10px] text-[#6B7280] px-0.5">{relativeTime(item.created_at)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 로그인 상태 */}
        {!loading && user && !selectedStyle && (
          <>
            {/* 프로필 */}
            <section className="-mx-4 border-y border-[#E7E7E7] bg-white px-4 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                {user.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profileImage} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#F1F1F1] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#9A9A9A] text-xl">?</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[22px] font-black tracking-[-0.04em] text-[#111827]">{user.nickname}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[#6B7280] text-[13px]">카카오 로그인</p>
                    {credits !== null && (
                      <Link href="/shop" className="text-[12px] px-2.5 py-1 rounded-full border border-[#E8D8CE] bg-[#FFF8F3] font-bold text-[#C9571A]">
                        {credits}크레딧
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="flex-shrink-0 text-[13px] font-semibold text-[#8A8A8A] transition-colors hover:text-[#111827]"
              >
                로그아웃
              </button>
              </div>
            </section>

            {/* 계정 설정 */}
            <section className="-mx-4 grid grid-cols-3 items-stretch border-y border-[#E7E7E7] bg-white divide-x divide-[#F0F0F0]">
              <div className="min-w-0 px-3 py-3">
                <div className="mb-2 flex h-7 w-7 items-center justify-center text-[#C9571A]">
                  <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                    <path d="M3.5 8h13v8.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V8zM2.5 5.5h15V8h-15V5.5zM10 5.5v12M7.4 2.5C9.2 2.5 10 5.5 10 5.5S6.6 5.6 6.1 4.2c-.3-.9.3-1.7 1.3-1.7zM12.6 2.5C10.8 2.5 10 5.5 10 5.5s3.4.1 3.9-1.3c.3-.9-.3-1.7-1.3-1.7z" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#6B7280]">선물 코드</p>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 rounded-full bg-[#F7F7F7] px-2 py-1.5">
                    <input
                      value={giftInput}
                      onChange={(e) => { setGiftInput(e.target.value.toUpperCase()); setGiftStatus("idle"); }}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleRedeemGift(); }}
                      placeholder="GIFT-XXXXXX"
                      maxLength={11}
                      className="min-w-0 flex-1 bg-transparent font-mono text-[11px] tracking-[0.08em] text-[#111827] placeholder-[#B8B8B8] outline-none"
                    />
                    <button
                      onClick={() => void handleRedeemGift()}
                      disabled={giftStatus === "loading" || !giftInput.trim()}
                      className="flex-shrink-0 rounded-full bg-[#111827] px-2 py-1 text-[10px] font-bold text-white transition-opacity disabled:opacity-40"
                    >
                      {giftStatus === "loading" ? "확인" : "사용"}
                    </button>
                  </div>
                  {giftStatus !== "idle" && (
                    <p className={`mt-1.5 line-clamp-2 text-[10px] ${giftStatus === "success" ? "text-green-600" : "text-red-600"}`}>
                      {giftMsg}
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-0 px-3 py-3">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="6" stroke="white" strokeWidth="1.8"/>
                    <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.8"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="white"/>
                  </svg>
                </div>

                {instaEditing ? (
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#6B7280]">Instagram</p>
                    <div className="mt-1 flex min-w-0 items-center rounded-full bg-[#F7F7F7] px-2 py-1.5">
                      <span className="flex-shrink-0 text-[12px] text-[#0A0A0A]/30">@</span>
                      <input
                        autoFocus
                        value={instaInput}
                        onChange={(e) => setInstaInput(e.target.value.replace(/^@+/, ""))}
                        onKeyDown={(e) => { if (e.key === "Enter") void handleSaveInsta(); if (e.key === "Escape") { setInstaInput(instaHandle); setInstaEditing(false); } }}
                        placeholder="instagram_id"
                        maxLength={30}
                        className="min-w-0 flex-1 bg-transparent text-[11px] text-[#111827] placeholder-[#B8B8B8] outline-none"
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => { setInstaInput(instaHandle); setInstaEditing(false); }}
                        className="text-[10px] font-semibold text-[#0A0A0A]/35 transition-colors hover:text-[#0A0A0A]/60"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => void handleSaveInsta()}
                        disabled={instaSaving}
                        className="rounded-full bg-[#C9571A] px-2 py-1 text-[10px] font-bold text-white transition-opacity disabled:opacity-50"
                      >
                        {instaSaving ? "저장 중" : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="flex w-full min-w-0 items-start justify-between text-left"
                    onClick={() => setInstaEditing(true)}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#6B7280]">Instagram</p>
                      {instaHandle ? (
                        <p className="mt-0.5 truncate text-[13px] font-semibold text-[#111827]">@{instaHandle}</p>
                      ) : (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#0A0A0A]/25">아이디를 입력해 주세요</p>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="ml-1 mt-0.5 flex-shrink-0 text-[#0A0A0A]/20">
                      <path d="M10.5 2.5L13.5 5.5L5.5 13.5H2.5V10.5L10.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}

                {/* 연결된 경우 외부 링크 */}
                {!instaEditing && instaHandle && (
                  <a
                    href={`https://instagram.com/${instaHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold text-[#DD2A7B]/75 transition-colors hover:text-[#DD2A7B]"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                      <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M8 1h3m0 0v3M11 1L5.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="truncate">instagram.com/{instaHandle}</span>
                  </a>
                )}
              </div>

              <div className="min-w-0 px-3 py-3">
                <div className="mb-2 flex h-7 w-7 items-center justify-center text-[#18A98D]">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="3" fill="currentColor"/>
                    <path d="M5.5 5.5a6.5 6.5 0 009 9M5.5 14.5a6.5 6.5 0 010-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#6B7280]">메인 스토리</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#111827]">
                    {showcaseState ? "공개 중" : "미공개"}
                  </p>
                </div>
                {showcaseState ? (
                  <div className="mt-2 flex min-w-0 items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={showcaseState.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-lg object-cover ring-1 ring-[#E8E8E8]" />
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] text-[#0A0A0A]/30">{relativeTime(showcaseState.createdAt)}</span>
                      <button
                        type="button"
                        onClick={handleHideFromHome}
                        className="text-[10px] font-semibold text-[#0A0A0A]/40 transition-colors hover:text-[#0A0A0A]/70"
                      >
                        해제
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-[#DDDDDD]" />
                )}
              </div>
            </section>

            {/* 최근 변환 기록 (탭) */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-[18px] font-black tracking-[-0.03em] text-[#111827]">최근 변환 기록</h2>
                <div className="flex items-center gap-1 bg-[#EFEFEF] rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setHistoryTab("cards")}
                    className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all ${historyTab === "cards" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280]"}`}
                  >
                    일반카드
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("lab")}
                    className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all ${historyTab === "lab" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280]"}`}
                  >
                    실험실
                  </button>
                </div>
              </div>

              {historyTab === "cards" && (
                historyLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-6 h-6 rounded-full border-2 border-[#E8E8E8] border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {VISIBLE_STYLE_IDS.filter(styleId => (grouped[styleId] ?? []).length > 0).map((styleId) => {
                      const items = grouped[styleId] ?? [];
                      const latest = items[0];
                      const expiry = categoryExpiry(items);
                      return (
                        <button
                          key={styleId}
                          onClick={() => setSelectedStyle(styleId)}
                          className="flex flex-col gap-3 bg-white border border-[#E7E7E7] p-3 hover:border-[#D1D5DB] transition-colors text-left min-w-0"
                        >
                          <div className="relative w-full aspect-square rounded-[14px] overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                            {latest ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={latest.result_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-[#9A9A9A] text-2xl">+</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[#111827] font-bold text-[14px] leading-snug break-keep">{STYLE_LABELS[styleId] ?? styleId}</p>
                            <p className="text-[#6B7280] text-[12px] mt-1">
                              {`${items.length}장`}{latest && ` · ${relativeTime(latest.created_at)}`}
                            </p>
                            {expiry && (
                              <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full border ${expiry.className}`}>
                                {expiry.label}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {VISIBLE_STYLE_IDS.every(id => (grouped[id] ?? []).length === 0) && (
                      <div className="col-span-2 flex flex-col items-center gap-3 py-12 text-center">
                        <p className="text-[#0A0A0A]/40 text-[15px]">아직 변환 기록이 없어요.</p>
                      </div>
                    )}
                  </div>
                )
              )}

              {historyTab === "lab" && (
                <div className="flex flex-col gap-5">
                  {/* AI 오디션 기록 */}
                  <div>
                    <p className="text-[13px] font-bold text-[#111827] mb-2 px-1">AI 오디션</p>
                    {historyLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 border-[#E8E8E8] border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                    ) : auditionHistory.length === 0 ? (
                      <Link href="/audition/intro" className="flex items-center justify-between bg-white border border-[#E7E7E7] rounded-2xl px-4 py-4 hover:border-[#D1D5DB] transition-colors">
                        <div>
                          <p className="text-[14px] font-bold text-[#111827]">AI 오디션</p>
                          <p className="text-[12px] text-[#9CA3AF] font-normal mt-0.5">아직 기록이 없어요 · 시작하기</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#D1D5DB] flex-shrink-0">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </Link>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {auditionHistory.map(item => {
                          const expiry = expiryBadge(item.created_at);
                          const scoreColor = item.avg_score >= 70 ? "#4ade80" : item.avg_score >= 45 ? "#f97316" : "#ef4444";
                          return (
                            <Link
                              key={item.id}
                              href={`/audition/result?history_share=${item.share_id}`}
                              className="flex flex-col bg-white border border-[#E7E7E7] p-3 rounded-2xl hover:border-[#D1D5DB] transition-colors min-w-0"
                            >
                              <div className="w-full aspect-square rounded-[14px] overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                                {item.still_image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.still_image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[#333] text-[22px]">🎬</div>
                                )}
                              </div>
                              <div className="min-w-0 mt-2.5">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest">AI 오디션</span>
                                  <span className="text-[14px] font-extrabold tabular-nums" style={{ color: scoreColor }}>{item.avg_score}점</span>
                                </div>
                                <p className="text-[#0A0A0A]/80 text-[13px] font-bold leading-snug break-keep">{item.assigned_role}</p>
                                <div className="flex items-end justify-between gap-1 mt-2">
                                  <span className="text-[11px] text-[#6B7280]">{relativeTime(item.created_at)}</span>
                                  <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full border ${expiry.className}`}>{expiry.label}</span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 너라면 그럴 줄 알았어 기록 */}
                  <div>
                    <p className="text-[13px] font-bold text-[#111827] mb-2 px-1">너라면 그럴 줄 알았어</p>
                    {historyLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 border-[#E8E8E8] border-t-[#F97316]" style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                    ) : naboPredictHistory.length === 0 ? (
                      <Link href="/nabo-predict" className="flex items-center justify-between bg-white border border-[#E7E7E7] rounded-2xl px-4 py-4 hover:border-[#D1D5DB] transition-colors">
                        <div>
                          <p className="text-[14px] font-bold text-[#111827]">너라면 그럴 줄 알았어</p>
                          <p className="text-[12px] text-[#9CA3AF] font-normal mt-0.5">아직 기록이 없어요 · 시작하기</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#D1D5DB] flex-shrink-0">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </Link>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {naboPredictHistory.map((item) => (
                          <Link
                            key={`${item.role}-${item.sessionId}`}
                            href={item.href || "/nabo-predict"}
                            className="flex flex-col border border-[#E7E7E7] bg-white p-3 rounded-2xl transition-colors hover:border-[#D1D5DB] min-w-0"
                          >
                            <div className="flex aspect-square items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#FFF7ED,#FED7AA_48%,#FB7185)]">
                              <div className="text-center text-[#9A3412]">
                                <p className="text-[11px] font-black tracking-[0.18em] uppercase">Predict</p>
                                <p className="mt-2 text-[24px]">🎯</p>
                              </div>
                            </div>
                            <div className="min-w-0 mt-2.5">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#F97316]">
                                  {item.role === "owner" ? "내 예측" : "내 답변"}
                                </span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.status === "completed" ? "bg-[#FFF7ED] text-[#EA580C]" : "bg-[#F4F4F4] text-[#777]"}`}>
                                  {item.status === "completed" ? "결과 열림" : "답변 대기"}
                                </span>
                              </div>
                              <p className="text-[14px] font-bold leading-snug text-[#111827] break-keep">
                                {item.ownerName}님이 본 {item.targetName}님
                              </p>
                              <p className="mt-0.5 text-[12px] text-[#777]">
                                {item.status === "completed" ? "결과 다시 보기" : "공유 링크 다시 열기"}
                              </p>
                              <div className="mt-2 flex items-end justify-between gap-2">
                                <span className="text-[11px] text-[#6B7280]">{relativeTime(new Date(item.completedAt ?? item.createdAt).toISOString())}</span>
                                <span className="text-[10px] font-normal text-[#9CA3AF]">마이페이지 저장</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 내가 보는 너 (나보) */}
                  <div>
                    <p className="text-[13px] font-bold text-[#111827] mb-2 px-1">내가 보는 너</p>
                    <Link href="/nabo" className="flex items-center justify-between bg-white border border-[#E7E7E7] rounded-2xl px-4 py-4 hover:border-[#D1D5DB] transition-colors">
                      <div>
                        <p className="text-[14px] font-bold text-[#111827]">내가 보는 너</p>
                        <p className="text-[12px] text-[#9CA3AF] font-normal mt-0.5">익명 관계 분석 · 바로가기</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#D1D5DB] flex-shrink-0">
                        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  </div>

                  {/* 여행 같이 간다면 기록 */}
                  <div>
                    <p className="text-[13px] font-bold text-[#111827] mb-2 px-1">여행 같이 간다면</p>
                    {historyLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 border-[#E8E8E8] border-t-[#60A5FA]" style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                    ) : travelHistory.length === 0 ? (
                      <Link href="/travel-together" className="flex items-center justify-between bg-white border border-[#E7E7E7] rounded-2xl px-4 py-4 hover:border-[#D1D5DB] transition-colors">
                        <div>
                          <p className="text-[14px] font-bold text-[#111827]">여행 같이 간다면</p>
                          <p className="text-[12px] text-[#9CA3AF] font-normal mt-0.5">아직 기록이 없어요 · 시작하기</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#D1D5DB] flex-shrink-0">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </Link>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {travelHistory.map((item) => (
                          <Link
                            key={item.roomId}
                            href={`/travel-together?room=${encodeURIComponent(item.roomId)}&token=${encodeURIComponent(item.participantToken)}&view=result`}
                            className="flex flex-col border border-[#E7E7E7] bg-white p-3 rounded-2xl transition-colors hover:border-[#D1D5DB] min-w-0"
                          >
                            <div className="flex aspect-square items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#DBEAFE,#BFDBFE_48%,#60A5FA)]">
                              <div className="text-center text-[#1E3A8A]">
                                <p className="text-[12px] font-black tracking-[0.22em] uppercase">Travel</p>
                                <p className="mt-2 text-[24px]">✈️</p>
                              </div>
                            </div>
                            <div className="min-w-0 mt-2.5">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#60A5FA]">여행 테스트</span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.unlocked ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F4F4F4] text-[#777]"}`}>
                                  {item.unlocked ? "상세 열림" : "기본 결과"}
                                </span>
                              </div>
                              <p className="text-[14px] font-bold leading-snug text-[#111827] break-keep">{item.partnerName}와 여행 궁합</p>
                              <p className="mt-0.5 text-[12px] text-[#777]">{TRAVEL_RELATION_LABELS[item.relation]}</p>
                              <div className="mt-2 flex items-end justify-between gap-2">
                                <span className="text-[11px] text-[#6B7280]">{relativeTime(item.completedAt)}</span>
                                <span className="text-[10px] font-normal text-[#9CA3AF]">완료된 테스트만 보관</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 스타일 상세 뷰 */}
        {!loading && user && selectedStyle && (
          <div className="flex flex-col gap-3">
            <div className="px-1">
              <h2 className="text-[20px] font-black tracking-[-0.03em] text-[#111827]">{STYLE_LABELS[selectedStyle] ?? selectedStyle}</h2>
              <p className="text-[13px] text-[#6B7280] mt-0.5">{selectedItems.length}장의 변환 기록</p>
            </div>

            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <p className="text-[#0A0A0A]/40 text-[15px]">아직 변환 기록이 없어요.</p>
                <button onClick={() => router.push("/studio")} className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold px-6 py-3 rounded-xl transition-colors">
                  스타일 적용하러 가기
                </button>
              </div>
            ) : (
              <>
                {/* 스크롤 캐러셀 */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="overflow-x-scroll -mx-4 flex"
                  style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                >
                  {selectedItems.map((item, idx) => {
                    const variantLabel = item.variant && item.variant !== "default"
                      ? (STYLE_VARIANTS[item.style_id]?.find(v => v.id === item.variant)?.label)
                      : null;
                    return (
                      <div
                        key={item.id}
                        className="flex-shrink-0 px-4"
                        style={{ width: "100%", scrollSnapAlign: "center" }}
                      >
                        <div className="relative">
                          {idx === activeIndex && (
                            <div className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-full bg-black/60 p-1 backdrop-blur-md border border-[#E8E8E8]">
                              <button
                                type="button"
                                onClick={() => setHistoryView("before")}
                                disabled={!item.before_image_url}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                  historyView === "before"
                                    ? "bg-white text-black"
                                    : item.before_image_url
                                      ? "text-[#0A0A0A]/70 hover:text-white"
                                      : "text-[#0A0A0A]/20 cursor-not-allowed"
                                }`}
                              >
                                BEFORE
                              </button>
                              <button
                                type="button"
                                onClick={() => setHistoryView("after")}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                  historyView === "after"
                                    ? "bg-[#C9571A] text-white"
                                    : "text-[#0A0A0A]/70 hover:text-white"
                                }`}
                              >
                                AFTER
                              </button>
                            </div>
                          )}
                          {idx === activeIndex && (
                            <button
                              type="button"
                              onClick={() => setHistoryDeleteTarget(item)}
                              className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-[#E8E8E8] hover:bg-[#ff4444] transition-colors"
                              aria-label="변환 기록 삭제"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M2.5 4h11M6.5 1.75h3M6 7v4.25M10 7v4.25M4.75 4l.5 8.25A1.5 1.5 0 006.75 13.7h2.5a1.5 1.5 0 001.5-1.45L11.25 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                          <HistoryPreview item={item} historyView={historyView} isActive={idx === activeIndex} />
                          {variantLabel && idx === activeIndex && (
                            <div className="absolute top-4 right-4 z-10">
                              <span className="bg-[#C9571A] text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg ring-1 ring-white/20">
                                {variantLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 페이지 인디케이터 */}
                {selectedItems.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {selectedItems.map((_, idx) => (
                      <div
                        key={idx}
                        className={`rounded-full transition-all duration-300 ${idx === activeIndex ? "w-4 h-1.5 bg-[#C9571A]" : "w-1.5 h-1.5 bg-[#D6D6D6]"}`}
                      />
                    ))}
                  </div>
                )}

                {/* 메타 정보 */}
                {(() => {
                  const item = selectedItems[activeIndex];
                  if (!item) return null;
                  const badge = expiryBadge(item.created_at);
                  return (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[12px] text-[#6B7280]">{relativeTime(item.created_at)}</span>
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}>{badge.label}</span>
                    </div>
                  );
                })()}

                {/* 고정 액션 버튼 */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => selectedItems[activeIndex] && handleSave(selectedItems[activeIndex].result_image_url)}
                    className="flex-1 bg-[#C9571A] hover:bg-[#B34A12] text-white py-3.5 rounded-2xl font-bold text-[15px] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M8 10l-3-3M8 10l3-3M1 12v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    저장
                  </button>
                  <button
                    onClick={() => selectedItems[activeIndex] && handleKakaoShare(selectedItems[activeIndex].result_image_url)}
                    className="flex-1 bg-[#FEE500] hover:bg-[#F0D900] text-[#191919] py-3.5 rounded-2xl font-bold text-[15px] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
                    카카오
                  </button>
                </div>

                {/* 메인 스토리 ON/OFF */}
                <button
                  type="button"
                  onClick={() => {
                    if (showcaseUploading) return;
                    if (showcaseState) {
                      void handleHideFromHome();
                    } else {
                      void handlePostToShowcase();
                    }
                  }}
                  disabled={showcaseUploading}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border font-bold text-[15px] transition-all disabled:opacity-60 ${
                    showcaseState
                      ? "bg-[#C9571A] border-[#C9571A] text-white"
                      : "bg-white border-[#D1D5DB] text-[#374151]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="3" fill="currentColor"/>
                      <path d="M5.5 5.5a6.5 6.5 0 019 9M5.5 14.5a6.5 6.5 0 010-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span>메인 스토리</span>
                    {showcaseState && instaHandle && (
                      <span className="text-[12px] font-normal opacity-75">· @{instaHandle}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {showcaseUploading ? (
                      <div className={`w-4 h-4 rounded-full border-2 animate-spin ${showcaseState ? "border-white/30 border-t-white" : "border-[#D1D5DB] border-t-[#C9571A]"}`} />
                    ) : (
                      <div className={`relative w-12 h-6 rounded-full transition-colors ${showcaseState ? "bg-white/25" : "bg-[#E5E7EB]"}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ${showcaseState ? "right-0.5 bg-white" : "left-0.5 bg-white"}`} />
                      </div>
                    )}
                    <span className={`text-[13px] font-black w-7 text-right ${showcaseState ? "text-white" : "text-[#9CA3AF]"}`}>
                      {showcaseState ? "ON" : "OFF"}
                    </span>
                  </div>
                </button>
              </>
            )}
          </div>
        )}

        {!loading && !selectedStyle && (
          <section className="pt-2">
            <button
              type="button"
              onClick={handleInstallApp}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9571A] px-4 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#B34A12]"
            >
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-[9px] border border-[#E0E0E0] bg-[#F0F0F0] shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                <Image
                  src="/apple-icon"
                  alt=""
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </span>
              {isStandalone ? "이미 홈 화면에서 실행 중" : "StyleDrop 홈 화면에 바로가기 추가"}
            </button>
          </section>
        )}

        {!loading && user && !selectedStyle && (
          <section className="-mx-4 border-y border-[#E7E7E7] bg-white divide-y divide-[#F0F0F0]">
            <div className="px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-[#C9571A]">
                  <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                    <path d="M7.25 9.25a3 3 0 100-6 3 3 0 000 6zM12.75 8.25a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.75 16.5c0-2.1 1.9-3.75 4.5-3.75s4.5 1.65 4.5 3.75M10.75 12.5c.55-.3 1.25-.5 2-.5 2.15 0 3.75 1.35 3.75 3.15" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-bold text-[#6B7280]">친구 초대</p>
                  </div>
                  <p className="mt-0.5 text-[15px] font-bold text-[#111827]">보상 현황</p>
                  <p className="mt-1 text-[12px] leading-5 text-[#8A8A8A]">
                    링크 클릭은 기록만 남고, 친구가 첫 AI 결과를 만들면 1명으로 인정돼요.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-3">
                  <p className="text-[11px] font-bold text-[#8A8A8A]">인정된 친구</p>
                  <p className="mt-1 text-[20px] font-black text-[#111827] tabular-nums">
                    {referralSummary?.qualifiedCount ?? 0}명
                  </p>
                </div>
                <div className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-3">
                  <p className="text-[11px] font-bold text-[#8A8A8A]">다음 보상까지</p>
                  <p className="mt-1 text-[20px] font-black text-[#C9571A] tabular-nums">
                    {referralSummary?.remainingForNextReward ?? 3}명
                  </p>
                </div>
                <div className="rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-3">
                  <p className="text-[11px] font-bold text-[#8A8A8A]">이번 달 보상</p>
                  <p className="mt-1 text-[20px] font-black text-[#111827] tabular-nums">
                    {referralSummary
                      ? `${referralSummary.monthlyRewardCredits}/${referralSummary.monthlyRewardCap}`
                      : "0/10"}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-[#6B7280]">친구 첫 결과 생성</span>
                <span className="font-bold text-[#111827]">
                  {referralSummary?.generationThreshold ?? 3}명마다 {referralSummary?.generationRewardCredits ?? 1}크레딧
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="text-[#6B7280]">친구 첫 결제</span>
                <span className="font-bold text-[#111827]">
                  나 {referralSummary?.paymentRewardCredits ?? 2}크레딧 · 친구 {referralSummary?.referredPaymentBonusCredits ?? 1}크레딧
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="text-[#6B7280]">월 최대 보상</span>
                <span className="font-bold text-[#111827]">
                  {referralSummary?.monthlyRewardCap ?? 10}크레딧
                </span>
              </div>
            </div>

            <div className="px-4 py-4">
              <button
                type="button"
                onClick={() => void handleCopyReferralLink()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9571A] px-4 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#B34A12]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6.5 9.5l3-3M8.25 3.75l.65-.65a2.5 2.5 0 113.54 3.54l-1.65 1.65a2.5 2.5 0 01-3.54 0M7.75 12.25l-.65.65a2.5 2.5 0 11-3.54-3.54l1.65-1.65a2.5 2.5 0 013.54 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                내 초대 링크 복사하기
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 px-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#AAAAAA]">
            © 2026 StyleDrop · <Link href="/terms" className="hover:text-[#0A0A0A]/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-[#0A0A0A]/30 transition-colors">개인정보처리방침</Link> · v0.3
          </p>
          {user && (
            <button onClick={() => setShowDeleteModal(true)} className="text-[11px] text-[#CCCCCC] hover:text-[#999] transition-colors">
              회원 탈퇴
            </button>
          )}
        </div>
      </footer>

      {/* 회원 탈퇴 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 border border-[#E5E7EB] w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[16px] font-bold text-[#111827]">정말 탈퇴하시겠습니까?</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">탈퇴 즉시 모든 데이터(변환 기록, 프로필 정보)가 영구 삭제되며 복구할 수 없습니다.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteModal(false)} className="border border-[#D1D5DB] bg-white text-[#111827] rounded-xl py-3 flex-1 font-medium">취소</button>
              <button onClick={handleDeleteAccount} disabled={deleting} className="bg-[#ff4444] text-white rounded-xl py-3 flex-1 font-bold disabled:opacity-50 transition-opacity">
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyDeleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => !deleting && setHistoryDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 border border-[#E5E7EB] w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[16px] font-bold text-[#111827]">삭제하시겠습니까?</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">다시 돌릴 수 없다. 확인을 누르면 즉시 삭제됩니다.</p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setHistoryDeleteTarget(null)}
                disabled={deleting}
                className="border border-[#D1D5DB] bg-white text-[#111827] rounded-xl py-3 flex-1 font-medium disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteHistoryItem}
                disabled={deleting}
                className="bg-[#ff4444] text-white rounded-xl py-3 flex-1 font-bold disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
