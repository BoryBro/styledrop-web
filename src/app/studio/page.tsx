"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
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
    beforeImg: null,
    afterImg: null,
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
    beforeImg: null,
    afterImg: null,
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
    beforeImg: null,
    afterImg: null,
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
    beforeImg: null,
    afterImg: null,
    bgColor: "#0a0a1a",
    tag: "준비중",
    active: false,
  },
];

type Toast = { id: number; message: string };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto max-w-sm w-full bg-[#1A1A1A] border border-white/10 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 cursor-pointer"
        >
          <span className="text-[#C9571A]">✦</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function Studio() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedStyleRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) console.error("[usage] API error:", data.error);
        setUsageCounts(data.counts ?? {});
      })
      .catch((e) => {
        console.error("[usage] fetch error:", e);
        setUsageCounts({});
      });
  }, []);

  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const handleCardClick = (style: typeof STYLES[0]) => {
    if (!style.active) {
      showToast("곧 출시됩니다 ✨");
      return;
    }
    setSelectedStyle(style.id);
    selectedStyleRef.current = style.id;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const styleId = selectedStyleRef.current;
    if (!styleId) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1024;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];

      sessionStorage.setItem("sd_styleId", styleId);
      sessionStorage.setItem("sd_imageBase64", base64);
      sessionStorage.setItem("sd_previewDataUrl", dataUrl);
      sessionStorage.removeItem("sd_resultDataUrl");
      sessionStorage.removeItem("sd_shareUrl");
      sessionStorage.removeItem("sd_shareLink");
      sessionStorage.setItem("sd_fromStudio", "1"); // 정상 진입 플래그

      router.push("/result");
    };
    img.src = url;
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

        {/* Header */}
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 sticky top-0 z-40">
          <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-4">
          <h2 className="text-[20px] font-bold text-white mb-1">스타일 선택</h2>
          <p className="text-[14px] text-[#666] mb-6">원하는 스타일을 선택하면 사진 앨범이 열립니다</p>

          <div className="flex flex-col gap-3">
            {STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => handleCardClick(style)}
                className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all duration-300 border-2 ${
                  selectedStyle === style.id
                    ? "border-[#C9571A] shadow-[0_4px_24px_rgb(201,87,26,0.3)]"
                    : "border-transparent"
                } ${!style.active ? "cursor-default" : "cursor-pointer"}`}
                style={{ backgroundColor: style.bgColor }}
              >
                {/* Split before/after for active cards with images */}
                {style.beforeImg && style.afterImg ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={style.beforeImg} alt="before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={style.afterImg} alt="after" className="absolute inset-0 w-full h-full object-cover" style={{ animation: "split-clip 4s ease-in-out infinite" }} draggable={false} />
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
                  <img src={style.bgImage} alt={style.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : null}

                {/* Coming soon dim */}
                {!style.active && <div className="absolute inset-0 bg-black/50" />}

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                {/* Bottom left text */}
                <div className="absolute bottom-0 left-0 p-5">
                  <p className="text-[24px] font-bold text-white leading-tight">{style.name}</p>
                  <p className="text-[14px] text-[#ccc] mt-0.5 break-keep">{style.desc}</p>
                  {style.active && (
                    <span className="inline-block mt-2 text-[13px] text-white/80 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                      사용 {usageCounts === null ? "..." : formatCount(usageCounts[style.id] ?? 0)}
                    </span>
                  )}
                </div>

                {/* Tag pill */}
                <div className="absolute top-4 left-4">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    style.tag === "무료" ? "bg-[#C9571A] text-white" : "bg-[#444] text-[#888]"
                  }`}>{style.tag}</span>
                </div>

                {/* Selected check */}
                {selectedStyle === style.id && (
                  <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#C9571A] flex items-center justify-center shadow-md">
                    <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
                      <path d="M1 5L4.5 8.5L13 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </main>

        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* Footer */}
        <footer className="py-6 text-center">
          <p className="text-[11px] text-[#333]">
            © 2026 StyleDrop · <Link href="/terms" className="hover:text-white/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-white/30 transition-colors">개인정보처리방침</Link> · v0.3
          </p>
        </footer>
      </div>
    </>
  );
}
