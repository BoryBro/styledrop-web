"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getGuestHistory, type GuestHistoryItem } from "@/lib/guest-history";
import { STYLE_LABELS, VISIBLE_STYLE_IDS } from "@/lib/styles";
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

interface KakaoSDK {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (options: Record<string, unknown>) => void };
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
  if (msLeft < 3 * 3600000) return { label, className: "bg-red-500/20 text-red-400" };
  if (msLeft < 12 * 3600000) return { label, className: "bg-yellow-500/20 text-yellow-400" };
  return { label, className: "bg-white/5 text-white/30" };
}

function categoryExpiry(items: { created_at: string }[]): { label: string; className: string } | null {
  if (items.length === 0) return null;
  const oldest = items.reduce((a, b) => a.created_at < b.created_at ? a : b);
  return expiryBadge(oldest.created_at);
}

export default function MyPage() {
  const { user, loading, logout } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [guestHistory, setGuestHistory] = useState<GuestHistoryItem[]>([]);
  const [auditionHistory, setAuditionHistory] = useState<AuditionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setGuestHistory(getGuestHistory());
      setHistoryLoading(false);
      return;
    }
    Promise.all([
      fetch("/api/history").then(r => r.json()).then(d => setHistory(d.history ?? [])).catch(() => {}),
      fetch("/api/audition/history").then(r => r.json()).then(d => setAuditionHistory(d.history ?? [])).catch(() => {}),
    ]).finally(() => setHistoryLoading(false));
    fetch("/api/credits")
      .then(r => r.json())
      .then(d => setCredits(d.credits ?? 0))
      .catch(() => {});
  }, [user, loading]);

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

  // 스타일별 그룹핑 (history가 없어도 STYLE_ORDER 전체 표시)
  const grouped = VISIBLE_STYLE_IDS.reduce<Record<string, HistoryItem[]>>((acc, id) => {
    acc[id] = history.filter(h => h.style_id === id);
    return acc;
  }, {});

  const selectedItems = selectedStyle ? (grouped[selectedStyle] ?? []) : [];

  useEffect(() => {
    setActiveIndex(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [selectedStyle]);

  // 스크롤 시 현재 활성 인덱스 감지
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.clientWidth;
    const idx = Math.round(el.scrollLeft / itemWidth);
    setActiveIndex(Math.min(idx, selectedItems.length - 1));
  }, [selectedItems.length]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-xl text-white text-sm px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
        {selectedStyle ? (
          <button onClick={() => setSelectedStyle(null)} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <Link href="/" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        <div className="w-8" />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-12 flex flex-col gap-6">

        {/* 비로그인 */}
        {!loading && !user && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#1A1010] border border-[#C9571A]/30 rounded-2xl px-4 py-3.5 flex flex-col gap-3">
              <p className="text-[13px] text-[#C9571A]/90 font-medium leading-relaxed">
                현재 기록은 이 브라우저에만 임시 보관됩니다.<br />
                영구 저장하려면 카카오 로그인을 해주세요!
              </p>
              <button
                onClick={() => { window.location.href = "/api/auth/kakao"; }}
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
                <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : guestHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-white/40 text-[15px]">아직 변환 기록이 없어요.<br />스타일을 적용해보세요!</p>
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
                      <img src={item.result_image_url} alt="" className="w-full aspect-square rounded-xl object-cover bg-white/5" />
                      <span className="text-[10px] text-[#555] px-0.5">{relativeTime(item.created_at)}</span>
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
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-3">
                {user.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profileImage} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white/30 text-xl">?</span>
                  </div>
                )}
                <div>
                  <p className="text-[18px] font-bold text-white">{user.nickname}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[#555] text-[13px]">카카오 로그인</p>
                    {credits !== null && (
                      <Link href="/shop" className="text-[12px] px-2 py-0.5 rounded-full bg-[#C9571A]/20 text-[#C9571A]">
                        ✦ {credits}크레딧
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="bg-[#2A2A2A] text-white text-[13px] font-medium px-4 py-2 rounded-xl border border-[#333] hover:bg-[#333] transition-colors flex-shrink-0"
              >
                로그아웃
              </button>
            </div>

            {/* 스타일별 기록 */}
            <div>
              <div className="flex items-baseline gap-2 mb-4 px-1">
                <h2 className="text-[16px] font-bold text-white">최근 변환 기록</h2>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
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
                        className="flex flex-col gap-3 bg-[#111] border border-white/5 rounded-2xl p-3 hover:border-white/15 transition-colors text-left min-w-0"
                      >
                        <div className="relative w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 bg-[#1A1A1A]">
                          {latest ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={latest.result_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[#333] text-2xl">✦</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-bold text-[14px] leading-snug break-keep">{STYLE_LABELS[styleId] ?? styleId}</p>
                          <p className="text-[#555] text-[12px] mt-1">
                            {`${items.length}장`}{latest && ` · ${relativeTime(latest.created_at)}`}
                          </p>
                          {expiry && (
                            <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full ${expiry.className}`}>
                              {expiry.label}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {VISIBLE_STYLE_IDS.every(id => (grouped[id] ?? []).length === 0) && (
                    <div className="col-span-2 flex flex-col items-center gap-3 py-12 text-center">
                      <p className="text-white/40 text-[15px]">아직 변환 기록이 없어요.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI 오디션 기록 */}
            {auditionHistory.length > 0 && (
              <div>
                <div className="flex items-baseline gap-2 mb-4 px-1">
                  <h2 className="text-[16px] font-bold text-white">AI 오디션 기록</h2>
                  <span className="text-[12px] text-[#555]">24시간 보관</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {auditionHistory.map(item => {
                    const expiry = expiryBadge(item.created_at);
                    const scoreColor = item.avg_score >= 70 ? "#4ade80" : item.avg_score >= 45 ? "#f97316" : "#ef4444";
                    return (
                      <Link
                        key={item.id}
                        href={`/audition/result?history_share=${item.share_id}`}
                        className="flex flex-col gap-3 bg-[#111] border border-white/5 rounded-2xl p-3 hover:border-white/15 transition-colors min-w-0"
                      >
                        <div className="w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 bg-[#1A1A1A]">
                          {item.still_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.still_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#333] text-[22px]">🎬</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest">AI 오디션</span>
                            <span className="text-[14px] font-extrabold tabular-nums" style={{ color: scoreColor }}>{item.avg_score}점</span>
                          </div>
                          <p className="text-white/80 text-[13px] font-bold leading-snug break-keep">
                            {item.assigned_role}
                          </p>
                          <div className="flex flex-col items-start gap-1.5 mt-2">
                            <span className="text-[11px] text-[#555]">{relativeTime(item.created_at)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${expiry.className}`}>{expiry.label}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 회원 탈퇴 */}
            <div className="mt-8 flex justify-center">
              <button onClick={() => setShowDeleteModal(true)} className="text-[13px] text-[#555] underline hover:text-[#888] transition-colors">
                회원 탈퇴
              </button>
            </div>
          </>
        )}

        {/* 스타일 상세 뷰 */}
        {!loading && user && selectedStyle && (
          <div className="flex flex-col gap-3">
            <div className="px-1">
              <h2 className="text-[18px] font-bold text-white">{STYLE_LABELS[selectedStyle] ?? selectedStyle}</h2>
              <p className="text-[13px] text-[#555] mt-0.5">{selectedItems.length}장의 변환 기록</p>
            </div>

            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <p className="text-white/40 text-[15px]">아직 변환 기록이 없어요.</p>
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.result_image_url}
                            alt=""
                            className={`w-full aspect-square rounded-2xl object-cover bg-[#1A1A1A] transition-opacity duration-300 ${idx === activeIndex ? "opacity-100" : "opacity-50"}`}
                          />
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
                        className={`rounded-full transition-all duration-300 ${idx === activeIndex ? "w-4 h-1.5 bg-[#C9571A]" : "w-1.5 h-1.5 bg-white/20"}`}
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
                      <span className="text-[12px] text-[#555]">{relativeTime(item.created_at)}</span>
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}>{badge.label}</span>
                    </div>
                  );
                })()}

                {/* 고정 액션 버튼 */}
                <div className="flex gap-3 pt-1 pb-2">
                  <button
                    onClick={() => selectedItems[activeIndex] && handleSave(selectedItems[activeIndex].result_image_url)}
                    className="flex-1 bg-[#C9571A] hover:bg-[#B34A12] text-white py-3.5 rounded-2xl font-bold text-[15px] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M8 10l-3-3M8 10l3-3M1 12v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    저장하기
                  </button>
                  <button
                    onClick={() => selectedItems[activeIndex] && handleKakaoShare(selectedItems[activeIndex].result_image_url)}
                    className="flex-1 bg-[#FEE500] hover:bg-[#F0D900] text-[#191919] py-3.5 rounded-2xl font-bold text-[15px] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
                    카카오 공유
                  </button>
                </div>
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
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2.5v7.5M9 10l-3-3M9 10l3-3M3 12.5v1a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0015 13.5v-1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {isStandalone ? "이미 홈 화면에서 실행 중" : "StyleDrop 홈 화면에 바로가기 추가"}
            </button>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-[11px] text-[#333]">
          © 2026 StyleDrop · <Link href="/terms" className="hover:text-white/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-white/30 transition-colors">개인정보처리방침</Link> · v0.3
        </p>
      </footer>

      {/* 회원 탈퇴 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm mx-4 border border-[#333] w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[16px] font-bold text-white">정말 탈퇴하시겠습니까?</p>
            <p className="text-[14px] text-[#999] mt-2 leading-relaxed">탈퇴 즉시 모든 데이터(변환 기록, 프로필 정보)가 영구 삭제되며 복구할 수 없습니다.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteModal(false)} className="bg-[#2A2A2A] text-white rounded-xl py-3 flex-1 font-medium">취소</button>
              <button onClick={handleDeleteAccount} disabled={deleting} className="bg-[#ff4444] text-white rounded-xl py-3 flex-1 font-bold disabled:opacity-50 transition-opacity">
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
