"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const STYLES = [
  {
    id: "flash-selfie",
    name: "플래시 필터",
    desc: "플래시 터트린듯한 느낌 적용",
    usage: "12.3K",
    bgImage: "/thumbnails/flash-after.jpg",
    beforeImg: "/thumbnails/flash-before.jpg",
    afterImg: "/thumbnails/flash-after.jpg",
    bgColor: "#1a1010",
    tag: "무료",
    active: true,
  },
  {
    id: "grab-selfie",
    name: "베트남 오토바이 셀카 필터",
    desc: "얼굴이 보이는 정확한 셀카 사진을 업로드해주세요.",
    usage: "0",
    bgImage: "/thumbnails/grab-after.jpg",
    beforeImg: "/thumbnails/grab-before.jpg",
    afterImg: "/thumbnails/grab-after.jpg",
    bgColor: "#0e2a1a",
    tag: "무료",
    active: true,
  },
  {
    id: "voxel-character",
    name: "픽셀 캐릭터 필터",
    desc: "사진 속 나를 블록으로 만든 3D 캐릭터로 변환",
    usage: "0",
    bgImage: "/thumbnails/voxel-after.jpg",
    beforeImg: "/thumbnails/voxel-before.jpg",
    afterImg: "/thumbnails/voxel-after.jpg",
    bgColor: "#0a1a2a",
    tag: "무료",
    active: true,
    hidden: false,
  },
  // 4K 업스케일링 — 데이터 보존, 화면 미표시
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
    hidden: true,
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
  const { user, loading, login } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    fetch("/api/remaining").then(r => r.json()).then(d => setRemaining(d.remaining)).catch(() => {});
    fetch("/api/credits").then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
  }, []);

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
    if (remaining === 0 && !user) {
      setShowLoginModal(true);
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
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
            {remaining !== null && (
              <span className={`text-[12px] px-2.5 py-1 rounded-full bg-[#1A1A1A] ${
                remaining === 0 && !user ? "text-[#FEE500]" : remaining === 0 ? "text-[#ff4444]" : "text-[#999]"
              }`}>
                {remaining === 0 && !user ? "로그인 필요" : `${remaining}회 남음`}
              </span>
            )}
          </div>
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <Link href="/shop" className="flex items-center gap-1.5 bg-[#1A1A1A] border border-white/8 px-3 py-1.5 rounded-full hover:border-[#C9571A]/40 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1h2l1.5 7h7l1-4.5H4" stroke="#C9571A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="6.5" cy="12" r="0.8" fill="#C9571A"/>
                    <circle cx="11" cy="12" r="0.8" fill="#C9571A"/>
                  </svg>
                  <span className="text-[11px] text-[#C9571A] font-bold">{credits !== null ? `${credits}크레딧` : "충전"}</span>
                </Link>
                <button onClick={() => router.push("/mypage")} className="flex items-center gap-2">
                  {user.profileImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profileImage} alt="" className="w-7 h-7 rounded-full object-cover" />
                  )}
                  <span className="text-[14px] font-medium text-white truncate max-w-[80px]">{user.nickname}</span>
                </button>
              </div>
            ) : (
              <button onClick={login} className="bg-[#FEE500] text-[#3C1E1E] text-[13px] font-bold px-3 py-1.5 rounded-lg">
                카카오 로그인
              </button>
            )
          )}
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-4">
          <h2 className="text-[20px] font-bold text-white mb-1">스타일 선택</h2>
          <p className="text-[14px] text-[#666] mb-6">원하는 스타일을 선택하면 사진 앨범이 열립니다</p>

          <div className="flex flex-col gap-3">
            {STYLES.filter(s => !s.hidden).map((style) => (
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

        {/* 비로그인 배너 */}
        {!loading && !user && (
          <div className="max-w-2xl mx-auto w-full px-4 pb-4">
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl px-5 py-4 flex flex-col gap-3">
              <p className="text-white/80 text-[14px] font-medium">카카오 로그인하면 하루 10회 + 히스토리 저장!</p>
              <button
                onClick={login}
                className="bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold py-3 w-full text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
                </svg>
                카카오로 로그인하기
              </button>
            </div>
          </div>
        )}

        {/* 크레딧 상품 안내 */}
        <div className="max-w-2xl mx-auto w-full px-4 pb-4">
          <Link href="/shop" className="block bg-[#111] border border-white/8 rounded-2xl px-5 py-4 hover:border-[#C9571A]/40 transition-colors">
            <p className="text-white/60 text-[12px] mb-2">✦ 워터마크 제거 크레딧</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[12px] bg-[#1A1A1A] text-white/70 px-3 py-1.5 rounded-full">10회 · 1,900원</span>
              <span className="text-[12px] bg-[#C9571A]/15 text-[#C9571A] px-3 py-1.5 rounded-full border border-[#C9571A]/20">30회 · 4,900원 인기</span>
              <span className="text-[12px] bg-[#1A1A1A] text-white/70 px-3 py-1.5 rounded-full">70회 · 9,900원</span>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="py-6 text-center px-4">
          <p className="text-[11px] text-[#333]">
            © 2026 StyleDrop · <Link href="/terms" className="hover:text-white/30 transition-colors">이용약관</Link> · <Link href="/privacy" className="hover:text-white/30 transition-colors">개인정보처리방침</Link>
          </p>
          <p className="text-[10px] text-[#2a2a2a] mt-1 leading-relaxed">
            상호: 핑거 · 대표자: 문지환 · 사업자등록번호: 707-79-00261<br/>
            주소: 대전광역시 서구 동서대로1030번길 8-6(내동) · 연락처: 010-5838-9960
          </p>
        </footer>
      </div>

      {/* 로그인 유도 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowLoginModal(false)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm mx-4 border border-[#333] text-center w-full" onClick={e => e.stopPropagation()}>
            <p className="text-[40px]">🔒</p>
            <p className="text-[18px] font-bold text-white mt-3">무료 체험이 끝났어요</p>
            <p className="text-[14px] text-[#999] mt-2 whitespace-pre-line leading-relaxed">{`카카오 로그인하면 하루 10회까지\n무료로 이용할 수 있어요!`}</p>
            <button
              onClick={() => { window.location.href = "/api/auth/kakao"; }}
              className="bg-[#FEE500] text-[#3C1E1E] font-bold text-[15px] w-full py-4 rounded-xl mt-4 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#3C1E1E"/>
              </svg>
              카카오로 로그인하기
            </button>
            <button onClick={() => setShowLoginModal(false)} className="text-[13px] text-[#555] mt-3 hover:text-[#888] transition-colors">
              다음에 할게요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
