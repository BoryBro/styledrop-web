"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { addGuestHistoryItem } from "@/lib/guest-history";

interface KakaoSDK {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (options: Record<string, unknown>) => void };
}

type Status = "loading" | "done" | "error";

export default function Result() {
  const [status, setStatus] = useState<Status>("loading");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [view, setView] = useState<"before" | "after">("after");
  const historySaved = useRef(false);
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);

  const fetchRemaining = () => {
    fetch("/api/remaining").then(r => r.json()).then(d => setRemaining(d.remaining)).catch(() => {});
  };

  useEffect(() => { fetchRemaining(); }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    // 새로고침 감지: 정상 진입 플래그 없으면 /studio로 리다이렉트
    const fromStudio = sessionStorage.getItem("sd_fromStudio");
    if (!fromStudio) {
      router.replace("/studio");
      return;
    }
    sessionStorage.removeItem("sd_fromStudio"); // 플래그 소비 (1회용)

    const styleId = sessionStorage.getItem("sd_styleId");
    const base64 = sessionStorage.getItem("sd_imageBase64");
    const preview = sessionStorage.getItem("sd_previewDataUrl");

    if (!styleId || !base64) {
      router.replace("/studio");
      return;
    }

    setSelectedStyle(styleId);
    setImageBase64(base64);
    setPreviewDataUrl(preview);

    // 카카오앱 복귀 시 캐시된 결과 복원
    const cachedResult = sessionStorage.getItem("sd_resultDataUrl");
    const cachedShareUrl = sessionStorage.getItem("sd_shareUrl");
    const cachedShareLink = sessionStorage.getItem("sd_shareLink");

    if (cachedResult) {
      setResultImage(cachedResult);
      if (cachedShareUrl) setShareUrl(cachedShareUrl);
      if (cachedShareLink) setShareLink(cachedShareLink);
      setStatus("done");
      return;
    }

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: styleId, imageBase64: base64, mimeType: "image/jpeg" }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.image) {
          const dataUrl = `data:image/jpeg;base64,${data.image}`;
          setResultImage(dataUrl);
          sessionStorage.setItem("sd_resultDataUrl", dataUrl);
          setStatus("done");
          fetchRemaining();

          // 로그인 유저: 서버가 이미 히스토리 저장함 (클라이언트 포스트 불필요)
          if (data.historyUrl) {
            sessionStorage.setItem("sd_shareUrl", data.historyUrl);
          }

          // 비회원: 로여스토리지에 임시 저장
          if (!data.shouldSaveHistory) {
            addGuestHistoryItem({
              style_id: styleId,
              result_image_url: dataUrl,
            });
          }
        } else {
          setErrorMessage(data.error ?? null);
          setIsRateLimited(res.status === 429);
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [router]);

  // visibilitychange — 카카오앱에서 복귀 시 결과 유지
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const cached = sessionStorage.getItem("sd_resultDataUrl");
        if (cached && status !== "done") {
          setResultImage(cached);
          setStatus("done");
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status]);

  // 히스토리 자동 저장 — 서버에서 이미 처리하므로 클라이언트에서는 불필요

  const handleSaveToAlbum = async () => {
    if (!resultImage) return;
    try {
      const res = await fetch(resultImage);
      const blob = await res.blob();
      const file = new File([blob], `styledrop-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "StyleDrop 이미지" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `styledrop-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("저장 실패:", e);
    }
  };

  const handleKakaoShare = async () => {
    if (!resultImage || !imageBase64) return;
    setShowFallback(false);
    try {
      let imgUrl = shareUrl || sessionStorage.getItem("sd_shareUrl");
      let link = shareLink || sessionStorage.getItem("sd_shareLink");

      if (!imgUrl || !link) {
        const base64 = resultImage.split(",")[1];
        const response = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beforeBase64: imageBase64, afterBase64: base64 }),
        });
        if (!response.ok) throw new Error("업로드 실패");
        const { id, url } = await response.json();
        link = `${window.location.origin}/share?id=${id}`;
        imgUrl = url;
        setShareUrl(imgUrl);
        setShareLink(link);
        sessionStorage.setItem("sd_shareUrl", imgUrl!);
        sessionStorage.setItem("sd_shareLink", link!);
      }

      const kakao = (window as Window & { Kakao?: KakaoSDK }).Kakao;
      if (!kakao) {
        showToast("카카오 SDK 로딩 중이에요. 잠시 후 다시 시도해주세요.");
        setShowFallback(true);
        return;
      }
      if (!kakao.isInitialized()) kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);

      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "AI가 바꿔준 내 사진",
          description: "StyleDrop으로 변환했어요",
          imageUrl: imgUrl,
          link: { mobileWebUrl: link, webUrl: link },
        },
      });

      if (user) {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "share_kakao", metadata: { style_id: selectedStyle } }),
        }).catch(() => {});
      }
    } catch (e) {
      console.error("카카오 공유 실패:", e);
      setShowFallback(true);
    }
  };

  // 결과 준비되면 백그라운드에서 share URL 미리 업로드
  useEffect(() => {
    if (status !== "done" || !resultImage || !imageBase64) return;
    const cached = shareUrl || sessionStorage.getItem("sd_shareUrl");
    if (cached) return;
    const base64 = resultImage.split(",")[1];
    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beforeBase64: imageBase64, afterBase64: base64 }),
    })
      .then((r) => r.json())
      .then(({ id, url }) => {
        if (!id || !url) return;
        const link = `${window.location.origin}/share?id=${id}`;
        setShareUrl(url);
        setShareLink(link);
        sessionStorage.setItem("sd_shareUrl", url);
        sessionStorage.setItem("sd_shareLink", link);
      })
      .catch(() => {/* 백그라운드 실패 — 공유 시점에 재시도 */});
  }, [status, resultImage, imageBase64, shareUrl]);

  const handleCopyLink = async () => {
    const link = shareLink || sessionStorage.getItem("sd_shareLink") || window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      showToast("링크가 복사됐어요!");
    } catch {
      showToast("복사에 실패했어요.");
    }
    if (user) {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "share_link_copy", metadata: { style_id: selectedStyle } }),
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
          <div className="bg-[#1A1A1A] border border-white/10 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
          {remaining !== null && (
            <span className={`text-[12px] px-2.5 py-1 rounded-full bg-[#1A1A1A] ${
              remaining === 0 && !user ? "text-[#FEE500]" : remaining === 0 ? "text-[#ff4444]" : "text-[#999]"
            }`}>
              {remaining === 0 && !user ? "로그인 필요" : `${remaining}회 남음`}
            </span>
          )}
        </div>
        {!authLoading && (
          user ? (
            <Link href="/mypage" className="flex items-center gap-2">
              {user.profileImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
              )}
              <span className="text-[14px] font-medium text-white truncate max-w-[120px]">{user.nickname}</span>
            </Link>
          ) : (
            <button onClick={login} className="bg-[#FEE500] text-[#3C1E1E] text-[13px] font-bold px-3 py-1.5 rounded-lg">
              카카오 로그인
            </button>
          )
        )}
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-4 flex flex-col" style={{ height: "calc(100vh - 52px)" }}>

        {/* Loading */}
        {status === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-5 bg-white/5 border border-white/10 rounded-3xl px-10 py-10 shadow-xl">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C9571A]" style={{ animation: "spin 1s linear infinite" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xl leading-none select-none">✦</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-base">AI 변환 중</p>
                <p className="text-white/50 text-xs mt-1">AI가 사진을 변환하고 있어요...</p>
                {user && (
                  <p className="text-[#C9571A]/80 text-xs mt-2.5 leading-relaxed">
                    화면 밖으로 나가도<br />
                    마이페이지에서 확인 가능합니다 📲
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center text-center max-w-xs w-full gap-3">
              {isRateLimited && !user ? (
                <>
                  <span className="text-[40px]">🔒</span>
                  <p className="text-white font-bold text-[18px] mt-1">무료 체험이 끝났어요</p>
                  <p className="text-[#999] text-[14px] leading-relaxed">
                    {errorMessage ?? "카카오 로그인하면 하루 10회까지\n무료로 이용할 수 있어요!"}
                  </p>
                  <button
                    onClick={() => { window.location.href = "/api/auth/kakao"; }}
                    className="bg-[#FEE500] text-[#3C1E1E] font-bold text-[15px] w-full py-4 rounded-xl flex items-center justify-center gap-2 mt-1"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
                    </svg>
                    카카오로 로그인하고 계속하기
                  </button>
                  <p className="text-[12px] text-[#666]">로그인하면 하루 10회 무료 + 변환 기록 저장</p>
                </>
              ) : (
                <>
                  <p className="text-white/70 text-base">
                    {errorMessage ?? "변환에 실패했어요. 다시 시도해주세요."}
                  </p>
                  <button onClick={() => router.push("/studio")} className="text-[#666] text-sm hover:text-white transition-colors">
                    다시 하기
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {status === "done" && resultImage && (
          <div className="flex flex-col gap-4 flex-1">
            {/* Toggle */}
            <div className="w-full bg-[#1A1A1A] p-1.5 rounded-full flex relative border border-white/10 shadow-lg">
              <div
                className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#333] border border-white/10 rounded-full transition-all duration-300 ease-in-out ${
                  view === "after" ? "left-[calc(50%+3px)]" : "left-[4px]"
                }`}
              />
              <button
                onClick={() => setView("before")}
                className={`relative flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${
                  view === "before" ? "text-white" : "text-white/40"
                }`}
              >
                원본 사진 (BEFORE)
              </button>
              <button
                onClick={() => setView("after")}
                className={`relative flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${
                  view === "after" ? "text-[#C9571A]" : "text-white/40"
                }`}
              >
                AI 변환 (AFTER)
              </button>
            </div>

            {/* Image */}
            <div className="relative flex-1 rounded-2xl overflow-hidden bg-[#1A1A1A] border border-white/10 flex items-center justify-center min-h-0">
              {view === "before" ? (
                previewDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewDataUrl} alt="원본" className="w-full h-full object-contain" />
                )
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultImage} alt="변환 결과" className="w-full h-full object-contain" />
              )}
              <div className="absolute top-4 left-4 z-10">
                <span className={`text-xs font-bold tracking-widest px-4 py-2 rounded-full backdrop-blur-md shadow-lg transition-colors ${
                  view === "before" ? "bg-black/70 text-white border border-white/20" : "bg-[#C9571A]/90 text-white border border-white/20"
                }`}>
                  {view === "before" ? "BEFORE" : "AFTER"}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSaveToAlbum}
                className="flex-1 bg-[#C9571A] hover:bg-[#B34A12] text-white py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>📥</span><span>저장</span>
              </button>
              <button
                onClick={handleKakaoShare}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>💬</span><span>카카오 공유</span>
              </button>
              <button
                onClick={() => router.push("/studio")}
                className="flex-1 bg-[#2A2A2A] hover:bg-[#333] text-white py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>🔄</span><span>다시 하기</span>
              </button>
            </div>

            {/* 링크 복사 폴백 */}
            {showFallback && (
              <button
                onClick={handleCopyLink}
                className="w-full py-3 text-sm text-[#888] border border-white/10 rounded-xl hover:text-white hover:border-white/20 transition-colors"
              >
                🔗 링크 복사하기
              </button>
            )}
          </div>
        )}
      </main>

    </div>
  );
}
