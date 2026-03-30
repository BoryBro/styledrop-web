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
  const [isSharing, setIsSharing] = useState(false);

  const fetchRemaining = () => {
    fetch("/api/remaining").then(r => r.json()).then(d => setRemaining(d.remaining)).catch(() => {});
  };

  useEffect(() => { fetchRemaining(); }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const fromStudio = sessionStorage.getItem("sd_fromStudio");
    if (!fromStudio) {
      router.replace("/studio");
      return;
    }
    sessionStorage.removeItem("sd_fromStudio");

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

  useEffect(() => {
    if (status !== "loading") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [status]);

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

  useEffect(() => {
    if (status !== "done" || !user || !shareUrl || !selectedStyle) return;
    if (historySaved.current) return;
    historySaved.current = true;
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style_id: selectedStyle, result_image_url: shareUrl }),
    }).catch(() => {});
  }, [status, user, shareUrl, selectedStyle]);

  const handleSaveToAlbum = async () => {
    if (!resultImage) return;
    try {
      const blob = await (await fetch(resultImage)).blob();
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        const file = new File([blob], "styledrop.jpg", { type: "image/jpeg" });
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "styledrop.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const handleKakaoShare = async () => {
    if (!resultImage || !imageBase64 || isSharing) return;
    setIsSharing(true);
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
        if (!response.ok) throw new Error("Upload failed");
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
      console.error("Kakao share failed:", e);
      setShowFallback(true);
    } finally {
      // 앱 전환 여유 시간을 위해 1.5초 후 해제
      setTimeout(() => setIsSharing(false), 1500);
    }
  };

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
      .catch(() => {});
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
    <div className="min-h-dvh bg-[#0A0A0A] flex flex-col">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-xl text-white text-sm px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
          {toast}
        </div>
      )}

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

        {status === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <style>{`
              @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 8px rgba(201,87,26,0.3); }
                50% { box-shadow: 0 0 24px rgba(201,87,26,0.6); }
              }
              @keyframes dot-bounce {
                0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                40% { opacity: 1; transform: scale(1.2); }
              }
            `}</style>
            <div className="flex flex-col items-center gap-6 bg-white/5 border border-white/10 rounded-3xl px-8 py-10 shadow-xl w-full max-w-xs" style={{ animation: "pulse-glow 2.5s ease-in-out infinite" }}>
              {/* Spinner */}
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C9571A] border-r-[#C9571A]/30" style={{ animation: "spin 1s linear infinite" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[#C9571A] text-2xl leading-none select-none" style={{ animation: "pulse-glow 2s ease-in-out infinite" }}>✦</span>
                </div>
              </div>

              {/* Text + animated dots */}
              <div className="text-center flex flex-col items-center gap-2">
                <p className="text-white font-bold text-lg">AI 변환 중</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C9571A]" style={{ animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <p className="text-white/40 text-xs mt-1">사진을 분석하고 스타일을 적용하고 있어요</p>
              </div>

              {/* Warning banner */}
              <div className="w-full bg-[#C9571A]/10 border border-[#C9571A]/30 rounded-2xl px-4 py-3.5 flex items-start gap-2.5">
                <span className="text-base leading-none mt-0.5 flex-shrink-0">🚨</span>
                <div className="flex flex-col gap-1">
                  <p className="text-[#C9571A] font-bold text-[13px]">화면을 고정해 주세요!</p>
                  <p className="text-[#C9571A]/60 text-[11px] leading-relaxed">
                    최상의 품질을 위해 AI가 정성껏 변환 중입니다.<br />완료될 때까지 잠시만 이 화면에서 기다려 주세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {status === "done" && resultImage && (
          <div className="flex flex-col gap-4 flex-1">
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

      {/* 공유 중 로딩 레이어 */}
      {isSharing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A1A1A]/90 border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-[280px] w-full mx-4 backdrop-blur-md">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-white/5" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-yellow-400 animate-spin" />
            </div>
            <div className="text-center flex flex-col gap-2">
              <p className="text-white font-bold text-base">카카오톡 공유 준비 중</p>
              <p className="text-white/40 text-xs leading-relaxed">
                잠시만 기다려 주세요 💬<br />
                곧 카카오톡 앱으로 연결됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
