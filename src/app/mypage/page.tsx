"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getGuestHistory, type GuestHistoryItem } from "@/lib/guest-history";

const STYLE_LABELS: Record<string, string> = {
  "flash-selfie": "플래시 필터",
  "grab-selfie": "베트남 오토바이 셀카 필터",
  "voxel-character": "픽셀 캐릭터 필터",
  "4k-upscale": "4K 업스케일링",
};

const STYLE_ORDER = ["flash-selfie", "grab-selfie", "voxel-character", "4k-upscale"];

type HistoryItem = {
  id: string;
  style_id: string;
  result_image_url: string;
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
  const hoursLeft = (new Date(iso).getTime() + 3 * 24 * 3600000 - Date.now()) / 3600000;
  if (hoursLeft < 24) return { label: "오늘 삭제", className: "bg-red-500/20 text-red-400" };
  if (hoursLeft < 48) return { label: "내일 삭제", className: "bg-yellow-500/20 text-yellow-400" };
  return { label: "2일 후 삭제", className: "bg-white/5 text-white/30" };
}

export default function MyPage() {
  const { user, loading, logout } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [guestHistory, setGuestHistory] = useState<GuestHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
    fetch("/api/history")
      .then(r => r.json())
      .then(data => setHistory(data.history ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
    fetch("/api/credits")
      .then(r => r.json())
      .then(d => setCredits(d.credits ?? 0))
      .catch(() => {});
  }, [user, loading]);

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

  // 스타일별 그룹핑 (history가 없어도 STYLE_ORDER 전체 표시)
  const grouped = STYLE_ORDER.reduce<Record<string, HistoryItem[]>>((acc, id) => {
    acc[id] = history.filter(h => h.style_id === id);
    return acc;
  }, {});

  const selectedItems = selectedStyle ? (grouped[selectedStyle] ?? []) : [];

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
        <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
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
                <span className="text-[12px] text-[#666]">3일간 보관</span>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {STYLE_ORDER.map((styleId) => {
                    const items = grouped[styleId] ?? [];
                    const latest = items[0];
                    return (
                      <button
                        key={styleId}
                        onClick={() => setSelectedStyle(styleId)}
                        className="flex items-center gap-4 bg-[#111] border border-white/5 rounded-2xl px-4 py-3.5 hover:border-white/15 transition-colors text-left"
                      >
                        {/* 썸네일 */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#1A1A1A]">
                          {latest ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={latest.result_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[#333] text-2xl">✦</span>
                            </div>
                          )}
                        </div>
                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-[15px]">{STYLE_LABELS[styleId] ?? styleId}</p>
                          <p className="text-[#555] text-[13px] mt-0.5">
                            {items.length === 0 ? "변환 기록 없음" : `${items.length}장`}
                            {latest && ` · ${relativeTime(latest.created_at)}`}
                          </p>
                        </div>
                        {/* 화살표 */}
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#444] flex-shrink-0">
                          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

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
          <div className="flex flex-col gap-4">
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
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="flex gap-3" style={{ width: `max-content` }}>
                  {selectedItems.map((item) => {
                    const badge = expiryBadge(item.created_at);
                    return (
                      <div key={item.id} className="flex flex-col gap-2 flex-shrink-0" style={{ width: "72vw", maxWidth: "300px" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.result_image_url}
                          alt=""
                          className="w-full aspect-square rounded-2xl object-cover bg-[#1A1A1A]"
                        />
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[12px] text-[#555]">{relativeTime(item.created_at)}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(item.result_image_url)}
                            className="flex-1 bg-[#C9571A] hover:bg-[#B34A12] text-white py-2.5 rounded-xl font-bold text-[13px] transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span>📥</span><span>저장</span>
                          </button>
                          <button
                            onClick={() => handleKakaoShare(item.result_image_url)}
                            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-2.5 rounded-xl font-bold text-[13px] transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span>💬</span><span>공유</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
