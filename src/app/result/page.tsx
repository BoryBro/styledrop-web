"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const router = useRouter();

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

    // 문제 1: 카카오앱 복귀 시 캐시된 결과 복원 (API 재호출 방지)
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
      .then((res) => res.json())
      .then((data) => {
        if (data.image) {
          const dataUrl = `data:image/jpeg;base64,${data.image}`;
          setResultImage(dataUrl);
          sessionStorage.setItem("sd_resultDataUrl", dataUrl);
          setStatus("done");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [router]);

  // 문제 1: visibilitychange — 카카오앱에서 복귀 시 결과 유지
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

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `styledrop_${selectedStyle}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleKakaoShare = async () => {
    if (!resultImage || !imageBase64) return;
    setShowFallback(false);
    try {
      // 문제 3: 이미 업로드된 URL 재사용 (중복 업로드 방지)
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

      // 문제 2: SDK 준비 확인
      const kakao = (window as Window & { Kakao?: KakaoSDK }).Kakao;
      if (!kakao) {
        showToast("카카오 SDK 로딩 중이에요. 잠시 후 다시 시도해주세요.");
        setShowFallback(true);
        return;
      }
      if (!kakao.isInitialized()) kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);

      // 문제 3: payload 최소화 (10KB 이하 유지)
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "AI가 바꿔준 내 사진",
          description: "StyleDrop으로 변환했어요",
          imageUrl: imgUrl,
          link: { mobileWebUrl: link, webUrl: link },
        },
      });
    } catch (e) {
      console.error("카카오 공유 실패:", e);
      // 문제 4: 폴백 처리
      setShowFallback(true);
    }
  };

  // 문제 4: 링크 복사 폴백
  const handleCopyLink = async () => {
    const link = shareLink || sessionStorage.getItem("sd_shareLink") || window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      showToast("링크가 복사됐어요!");
    } catch {
      showToast("복사에 실패했어요.");
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
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 sticky top-0 z-40">
        <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">

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
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="text-white/60 text-base">변환에 실패했어요. 다시 시도해주세요.</p>
              <button onClick={() => router.push("/studio")} className="text-[#666] text-sm hover:text-white transition-colors">
                다시 하기
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {status === "done" && resultImage && (
          <div className="flex flex-col gap-6">
            {/* BEFORE */}
            <div className="relative w-full rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden flex items-center justify-center">
              <span className="absolute top-4 left-4 z-10 text-xs font-bold tracking-widest text-white bg-black/60 backdrop-blur-sm py-1.5 px-3 rounded-full">BEFORE</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previewDataUrl && <img src={previewDataUrl} alt="원본" className="w-full h-auto object-contain max-h-[60vh]" />}
            </div>

            {/* AFTER */}
            <div className="relative w-full rounded-2xl border-2 border-[#C9571A]/50 bg-[#1A1A1A] overflow-hidden flex items-center justify-center shadow-[0_4px_20px_rgb(201,87,26,0.15)]">
              <span className="absolute top-4 left-4 z-10 text-xs font-bold tracking-widest text-white bg-[#C9571A]/80 backdrop-blur-sm py-1.5 px-3 rounded-full">AFTER</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultImage} alt="변환 결과" className="w-full h-auto object-contain max-h-[60vh]" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSaveToAlbum}
                className="flex-1 bg-[#C9571A] hover:bg-[#B34A12] text-white py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>📥</span><span>이미지 저장</span>
              </button>
              <button
                onClick={handleKakaoShare}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>💬</span><span>카카오톡 공유</span>
              </button>
            </div>

            {/* 문제 4: 폴백 버튼 */}
            {showFallback && (
              <button
                onClick={handleCopyLink}
                className="w-full py-3 text-sm text-[#888] border border-white/10 rounded-xl hover:text-white hover:border-white/20 transition-colors"
              >
                🔗 링크 복사하기
              </button>
            )}

            <button onClick={handleDownload} className="w-full py-3 text-sm text-[#555] hover:text-white transition-colors">
              다운로드
            </button>
            <button onClick={() => router.push("/studio")} className="w-full py-3 text-sm text-[#555] hover:text-white transition-colors">
              다시 하기 →
            </button>
          </div>
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
