"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const STYLE_LABELS: Record<string, string> = {
  "flash-selfie": "플래시 필터",
  "grab-selfie": "그랩 셀카",
  "4k-upscale": "4K 업스케일링",
};

const STYLE_ORDER = ["flash-selfie", "grab-selfie", "4k-upscale"];

type HistoryItem = {
  id: string;
  style_id: string;
  result_image_url: string;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "방금 전" : `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  return `${days}일 전`;
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { setHistoryLoading(false); return; }
    fetch("/api/history")
      .then(r => r.json())
      .then(data => setHistory(data.history ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
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

  // 스타일별 그룹핑
  const grouped = STYLE_ORDER.reduce<Record<string, HistoryItem[]>>((acc, id) => {
    const items = history.filter(h => h.style_id === id);
    if (items.length > 0) acc[id] = items;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
        <div className="w-8" />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-12 flex flex-col gap-6">

        {/* 비로그인 */}
        {!loading && !user && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center py-20">
            <p className="text-white/60 text-base">로그인이 필요해요</p>
            <button
              onClick={() => { window.location.href = "/api/auth/kakao"; }}
              className="bg-[#FEE500] text-[#3C1E1E] font-bold px-6 py-3 rounded-xl text-[15px] flex items-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
              </svg>
              카카오로 로그인하기
            </button>
          </div>
        )}

        {/* 로그인 상태 */}
        {!loading && user && (
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
                  <p className="text-[#555] text-[13px] mt-0.5">카카오 로그인</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="bg-[#2A2A2A] text-white text-[13px] font-medium px-4 py-2 rounded-xl border border-[#333] hover:bg-[#333] transition-colors flex-shrink-0"
              >
                로그아웃
              </button>
            </div>

            {/* 히스토리 */}
            <div>
              <div className="flex items-baseline gap-2 mb-4 px-1">
                <h2 className="text-[16px] font-bold text-white">최근 변환 기록</h2>
                <span className="text-[12px] text-[#666]">3일간 보관</span>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                  <p className="text-white/40 text-[15px]">아직 변환 기록이 없어요.<br />스타일을 적용해보세요!</p>
                  <button
                    onClick={() => router.push("/studio")}
                    className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    스타일 적용하러 가기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  {Object.entries(grouped).map(([styleId, items], i) => (
                    <div key={styleId} className={`py-4 ${i > 0 ? "border-t border-[#1A1A1A]" : ""}`}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="text-[14px] font-medium text-[#ccc]">{STYLE_LABELS[styleId] ?? styleId}</span>
                        <span className="text-[12px] text-[#666]">{items.length}장</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {items.map(item => {
                          const badge = expiryBadge(item.created_at);
                          return (
                            <button
                              key={item.id}
                              onClick={() => window.open(item.result_image_url, "_blank")}
                              className="flex flex-col gap-1"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.result_image_url}
                                alt=""
                                className="w-full aspect-square rounded-xl object-cover bg-white/5"
                              />
                              <div className="flex flex-col items-start gap-0.5 px-0.5">
                                <span className="text-[11px] text-[#555]">{relativeTime(item.created_at)}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 회원 탈퇴 */}
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-[13px] text-[#555] underline hover:text-[#888] transition-colors"
              >
                회원 탈퇴
              </button>
            </div>
          </>
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
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-[#2A2A2A] text-white rounded-xl py-3 flex-1 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-[#ff4444] text-white rounded-xl py-3 flex-1 font-bold disabled:opacity-50 transition-opacity"
              >
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
