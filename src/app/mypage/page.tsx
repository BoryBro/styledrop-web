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

export default function MyPage() {
  const { user, loading, logout } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
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

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-8 flex flex-col gap-6">
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
            <div className="flex items-center gap-4 bg-[#1A1A1A] border border-white/10 rounded-2xl px-5 py-4">
              {user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImage} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-white/30 text-2xl">?</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg truncate">{user.nickname}</p>
                <p className="text-[#555] text-[13px] mt-0.5">카카오 로그인</p>
              </div>
              <button
                onClick={logout}
                className="text-[#555] text-[13px] hover:text-white/40 transition-colors flex-shrink-0"
              >
                로그아웃
              </button>
            </div>

            {/* 히스토리 */}
            <div>
              <h2 className="text-[16px] font-bold text-white mb-3">최근 변환 기록 <span className="text-[#444] font-normal text-[13px]">(3일간 보관)</span></h2>

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
                <div className="flex flex-col gap-3">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => window.open(item.result_image_url, "_blank")}
                      className="flex items-center gap-4 bg-[#1A1A1A] border border-white/10 rounded-2xl px-4 py-3 hover:border-white/20 transition-colors text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.result_image_url}
                        alt=""
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-white/5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-[15px]">
                          {STYLE_LABELS[item.style_id] ?? item.style_id}
                        </p>
                        <p className="text-[#555] text-[13px] mt-1">{relativeTime(item.created_at)}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-white/20">
                        <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                </div>
              )}
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
    </div>
  );
}
