"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

interface KakaoSDK {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (options: Record<string, unknown>) => void };
}

const STYLES = [
  {
    id: "flash-selfie",
    name: "플래시 필터",
    desc: "아이폰 플래시 특유의 선명하고 밝은 감성",
    usage: "12.3K",
    bgImage: "/thumbnails/flash-after.jpg",
    beforeImg: "/thumbnails/flash-before.jpg",
    afterImg: "/thumbnails/flash-after.jpg",
    bgColor: "#1a1010",
    tag: "무료",
    active: true,
  },
  {
    id: "4k-upscale",
    name: "4K 업스케일링",
    desc: "저화질 사진도 고해상도로 선명하게 복원",
    usage: "8.7K",
    bgImage: "/thumbnails/4k-after.jpg",
    beforeImg: "/thumbnails/4k-before.jpg",
    afterImg: "/thumbnails/4k-after.jpg",
    bgColor: "#0e1a1a",
    tag: "무료",
    active: true,
  },
  {
    id: "film-vintage",
    name: "필름 감성",
    desc: "Kodak 필름 특유의 따뜻한 grain 감성",
    usage: "34.1K",
    bgImage: null,
    bgColor: "#2a1a0e",
    tag: "준비중",
    active: false,
  },
  {
    id: "ghibli",
    name: "지브리 변환",
    desc: "스튜디오 지브리 애니메이션 화풍으로 변환",
    usage: "51.2K",
    bgImage: null,
    bgColor: "#0e1f2a",
    tag: "준비중",
    active: false,
  },
  {
    id: "id-photo",
    name: "AI 증명사진",
    desc: "깔끔한 배경의 고품질 증명사진 자동 생성",
    usage: "28.9K",
    bgImage: null,
    bgColor: "#1a1a2a",
    tag: "준비중",
    active: false,
  },
  {
    id: "night-city",
    name: "야경 감성",
    desc: "보케 빛망울과 함께하는 도시 야경 분위기",
    usage: "19.4K",
    bgImage: null,
    bgColor: "#0a0a1a",
    tag: "준비중",
    active: false,
  },
];

type Toast = { id: number; message: string; type: "error" | "info" };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto max-w-sm w-full bg-[#1A1A1A] border border-white/10 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex items-start gap-3 cursor-pointer"
        >
          <span className="mt-0.5 shrink-0 text-[#C9571A]">✕</span>
          <span className="leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");

  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isAgreed, setIsAgreed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type: "error" }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType("image/jpeg");
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultImage(null);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_SIZE = 1024;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setImageBase64(dataUrl.split(",")[1]);
        }
      };
      img.src = url;
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedStyle) {
      showToast("스타일을 선택해주세요.");
      return;
    }
    if (!imageBase64) {
      showToast("사진을 업로드해주세요.");
      return;
    }

    setIsLoading(true);
    setResultImage(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: selectedStyle,
          imageBase64,
          mimeType
        })
      });

      const data = await response.json();
      if (data.image) {
        setResultImage(`data:image/jpeg;base64,${data.image}`);
      } else {
        showToast(data.error || "이미지 변환에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      showToast("요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToAlbum = async () => {
    if (!resultImage) return;

    try {
      const res = await fetch(resultImage);
      const blob = await res.blob();
      const file = new File([blob], `styledrop-${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'StyleDrop 이미지',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `styledrop-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('저장 실패:', error);
      showToast('저장에 실패했습니다.');
    }
  };

  const handleKakaoShare = async () => {
    if (!resultImage) return;

    try {
      if (!imageBase64) return;
      const base64 = resultImage.split(',')[1];
      
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          beforeBase64: imageBase64,
          afterBase64: base64 
        })
      });

      if (!response.ok) {
        throw new Error('공유 이미지 업로드에 실패했습니다.');
      }

      const { id, url } = await response.json();
      const imageUrl = url;
      const shareLink = `${window.location.origin}/share?id=${id}`;

      // Kakao SDK로 공유
      const kakao = (window as Window & { Kakao?: KakaoSDK }).Kakao;
      if (!kakao) {
        showToast('카카오 SDK를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      if (!kakao.isInitialized()) {
        kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);
      }
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: 'StyleDrop으로 변환한 사진',
          description: 'AI가 새롭게 바꿔준 제 사진 어때요?',
          imageUrl: imageUrl,
          link: {
            mobileWebUrl: shareLink,
            webUrl: shareLink,
          },
        },
      });
    } catch (error) {
      console.error('카카오 공유 실패:', error);
      showToast('카카오톡 공유에 실패했습니다.');
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

  return (
    <>
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col pb-12">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-xl tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
          <span className="text-white/40 text-xs font-medium">사진 한 장, 감성은 AI가</span>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-5">
          <h2 className="text-lg font-bold text-white">스타일 선택</h2>
          <span className="text-xs text-white/40 font-medium">원하는 스타일을 선택하고 사진을 업로드하세요</span>
        </div>
        <div className="flex flex-col gap-3">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => {
                if (!style.active) return;
                setSelectedStyle(style.id);
                fileInputRef.current?.click();
              }}
              className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all duration-300 border-2 ${
                selectedStyle === style.id
                  ? "border-point shadow-[0_4px_24px_rgb(201,87,26,0.3)]"
                  : "border-transparent"
              } ${!style.active ? "cursor-default" : "cursor-pointer"}`}
              style={{ backgroundColor: style.bgColor }}
            >
              {/* Split before/after for cards with images */}
              {"beforeImg" in style && style.beforeImg && style.afterImg ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={style.beforeImg} alt="before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={style.afterImg} alt="after" className="absolute inset-0 w-full h-full object-cover" style={{ animation: "split-clip 4s ease-in-out infinite" }} draggable={false} />
                  {/* Divider line + handle */}
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
                <img src={style.bgImage} alt={style.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : null}
              {/* Coming soon dim overlay */}
              {!style.active && (
                <div className="absolute inset-0 bg-black/50" />
              )}
              {/* Bottom gradient */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              {/* Bottom left: name + desc + usage */}
              <div className="absolute bottom-0 left-0 p-5">
                <p className="text-[24px] font-bold text-white leading-tight">{style.name}</p>
                <p className="text-[14px] text-[#ccc] mt-0.5 break-keep">{style.desc}</p>
                <span className="inline-block mt-2 text-[13px] text-white/80 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10">사용 {style.usage}</span>
              </div>
              {/* Tag pill — top left */}
              <div className="absolute top-4 left-4">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  style.tag === "무료" ? "bg-point text-white" : "bg-[#444] text-[#888]"
                }`}>{style.tag}</span>
              </div>
              {/* Selected check — top right */}
              {selectedStyle === style.id && (
                <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-point flex items-center justify-center shadow-md">
                  <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L4.5 8.5L13 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>


      <section className="mb-auto">
        <h2 className="text-lg font-bold mb-4 px-1 text-white">
          {resultImage ? "변환 결과 비교" : "사진 업로드"}
        </h2>

        {resultImage ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
            {/* BEFORE Image */}
            <div className="flex flex-col gap-3">
              <div className="relative w-full rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden flex items-center justify-center">
                <span className="absolute top-4 left-4 z-10 text-xs font-bold tracking-widest text-white bg-black/60 backdrop-blur-sm py-1.5 px-3 rounded-full">BEFORE</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl!} alt="Original Image" className="w-full h-auto object-contain max-h-[60vh] md:max-h-[70vh]" />
              </div>
            </div>

            {/* AFTER Image */}
            <div className="flex flex-col gap-3">
              <div className="relative w-full rounded-2xl border-2 border-point/50 bg-[#1A1A1A] overflow-hidden flex items-center justify-center shadow-[0_4px_20px_rgb(201,87,26,0.15)]">
                <span className="absolute top-4 left-4 z-10 text-xs font-bold tracking-widest text-white bg-point/80 backdrop-blur-sm py-1.5 px-3 rounded-full">AFTER</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultImage} alt="Generated Result" className="w-full h-auto object-contain max-h-[60vh] md:max-h-[70vh]" />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSaveToAlbum}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>📥</span>
                  <span>앨범에 저장</span>
                </button>

                <button
                  onClick={handleKakaoShare}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>💬</span>
                  <span>카카오톡 공유</span>
                </button>
              </div>
              <button
                onClick={handleDownload}
                className="w-full bg-point hover:bg-[#B34A12] text-white py-3.5 md:py-4 rounded-xl text-md font-bold transition-all duration-300 shadow-md shadow-point/20 hover:-translate-y-0.5"
              >
                다운로드
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={isLoading ? undefined : handleUploadClick}
            className={`w-full aspect-[4/3] sm:aspect-video rounded-2xl border-2 border-dashed bg-card flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group ${isLoading ? 'border-point/30 cursor-not-allowed' : 'border-[#333] hover:border-point/50'}`}
          >
            {/* Glassmorphism loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                {/* Radial orange glow layer (behind blur) */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,87,26,0.35)_0%,rgba(0,0,0,0.6)_70%)] animate-pulse" />
                {/* Frosted glass blur layer */}
                <div className="absolute inset-0 backdrop-blur-xl" />
                {/* Glass panel card – perfectly centered */}
                <div className="relative z-10 flex flex-col items-center gap-5 bg-white/8 border border-white/15 rounded-3xl px-10 py-8 shadow-[0_8px_32px_rgba(201,87,26,0.25)]">
                  {/* Spinning ring: star icon is truly centered */}
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                    <div
                      className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C9571A]"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    {/* Centered ✦ — does NOT rotate */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-xl leading-none select-none">✦</span>
                    </div>
                  </div>
                  {/* Text */}
                  <div className="text-center">
                    <p className="text-white font-bold text-base tracking-wide">AI 변환 중</p>
                    <p className="text-white/50 text-xs mt-1 font-medium">Gemini가 사진의 감성을 입히고 있어요...</p>
                  </div>
                </div>
              </div>
            )}
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {!isLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">사진 변경하기</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-6 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-white/40 group-hover:text-point transition-colors group-hover:bg-point/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-white/80 font-medium text-base">사진을 여기에 드래그하거나 클릭해서 선택</p>
                <p className="text-[0.75rem] text-[#555] mt-2">JPG, PNG · 최대 10MB</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={isLoading ? undefined : handleFileChange}
              accept="image/*"
              className="hidden"
              disabled={isLoading}
            />
          </div>
        )}
      </section>

      {/* Bottom actions - natural flex-col, no sticky */}
      <div className="flex flex-col gap-4 mt-6 pb-8">

        {resultImage ? (
          <button
            onClick={() => {
              setResultImage(null);
              setPreviewUrl(null);
              setImageBase64(null);
              setSelectedStyle(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="w-full bg-[#2A2A2A] hover:bg-[#333] text-white py-4 rounded-2xl text-lg font-bold transition-all duration-300"
          >
            새로운 사진 만들기
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 px-1">
              <p className="text-[11px] md:text-xs text-white/40 font-medium">
                업로드된 사진은 서버에 저장되지 않으며, AI 처리 후 즉시 삭제됩니다.
              </p>
              <label className="flex items-center gap-3 cursor-pointer group w-fit">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    className="peer appearance-none w-5 h-5 rounded border-2 border-white/20 checked:border-point checked:bg-point transition-colors cursor-pointer"
                  />
                  <svg
                    className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                    viewBox="0 0 14 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm md:text-base text-white/80 font-medium select-none group-hover:text-white transition-colors">
                  <Link href="/terms" className="text-point hover:underline underline-offset-4" target="_blank">이용약관</Link> 및 <Link href="/privacy" className="text-point hover:underline underline-offset-4" target="_blank">개인정보처리방침</Link>에 동의합니다.
                </span>
              </label>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !isAgreed}
              className={`w-full py-4 md:py-5 rounded-2xl text-lg md:text-xl font-bold transition-all duration-300 ${isLoading || !isAgreed
                ? "bg-[#2A2A2A] text-white/30 cursor-not-allowed"
                : "bg-point hover:bg-[#B34A12] text-white shadow-lg shadow-point/20 hover:shadow-point/40 hover:-translate-y-1 active:translate-y-0"
                }`}
            >
              {isLoading ? "처리 중..." : "만들기"}
            </button>
          </div>
        )}
      </div>

      <footer className="mt-4 text-center flex flex-col items-center justify-center gap-2 pb-6">
        <div className="flex gap-4 text-xs font-medium text-white/40">
          <Link href="/terms" className="hover:text-white transition-colors underline-offset-4 hover:underline">이용약관</Link>
          <span>|</span>
          <Link href="/privacy" className="hover:text-white transition-colors underline-offset-4 hover:underline">개인정보처리방침</Link>
        </div>
        <p className="text-[10px] text-white/20">&copy; {new Date().getFullYear()} StyleDrop. All rights reserved.</p>
        <p className="text-[10px] text-yellow-200/40">v0.2</p>
      </footer>
    </main>
    </>
  );
}
