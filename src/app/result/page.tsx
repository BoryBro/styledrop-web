"use client";

import { useState, useEffect } from "react";
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
  const router = useRouter();

  useEffect(() => {
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

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: styleId, imageBase64: base64, mimeType: "image/jpeg" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.image) {
          setResultImage(`data:image/jpeg;base64,${data.image}`);
          setStatus("done");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [router]);

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
    try {
      const base64 = resultImage.split(",")[1];
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeBase64: imageBase64, afterBase64: base64 }),
      });
      if (!response.ok) throw new Error("공유 이미지 업로드 실패");
      const { id, url } = await response.json();
      const shareLink = `${window.location.origin}/share?id=${id}`;
      const kakao = (window as Window & { Kakao?: KakaoSDK }).Kakao;
      if (!kakao) return;
      if (!kakao.isInitialized()) kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "StyleDrop으로 변환한 사진",
          description: "AI가 새롭게 바꿔준 제 사진 어때요?",
          imageUrl: url,
          link: { mobileWebUrl: shareLink, webUrl: shareLink },
        },
      });
    } catch (e) {
      console.error("카카오 공유 실패:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
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
              <button
                onClick={() => router.push("/studio")}
                className="text-[#666] text-sm hover:text-white transition-colors"
              >
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
                <span>📥</span><span>결과 이미지 저장</span>
              </button>
              <button
                onClick={handleKakaoShare}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>💬</span><span>카카오톡 공유</span>
              </button>
            </div>

            <button
              onClick={handleDownload}
              className="w-full py-3 text-sm text-[#555] hover:text-white transition-colors"
            >
              다운로드
            </button>

            <button
              onClick={() => router.push("/studio")}
              className="w-full py-3 text-sm text-[#555] hover:text-white transition-colors"
            >
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
