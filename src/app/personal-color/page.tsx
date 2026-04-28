"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePersonalColorAvailability } from "@/hooks/usePersonalColorAvailability";
import { useRecentPhotos } from "@/hooks/useRecentPhotos";
import { trackClientEvent } from "@/lib/client-events";
import { ALL_STYLES } from "@/lib/styles";
import {
  analyzePersonalColor,
  PERSONAL_COLOR_PROFILES,
  type PersonalColorFailure,
  type PersonalColorSeason,
  type PersonalColorSuccess,
  type PersonalColorSwatch,
} from "@/lib/personal-color";

type AnalysisState = "idle" | "analyzing" | "done";
type ResultTab = "analysis" | "palette" | "makeup" | "styles";

const TONE_MIRROR_ORDER: PersonalColorSeason[] = [
  "spring-warm",
  "summer-cool",
  "autumn-warm",
  "winter-cool",
];

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  const r = Number.parseInt(safeHex.slice(0, 2), 16);
  const g = Number.parseInt(safeHex.slice(2, 4), 16);
  const b = Number.parseInt(safeHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function AxisMeter({
  label,
  score,
  helper,
  accent,
}: {
  label: string;
  score: number;
  helper: string;
  accent: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-4 shadow-[0_20px_50px_rgba(11,15,28,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.16em] text-[#8891A2] uppercase">{label}</p>
          <p className="mt-2 text-[18px] font-bold text-[#131A2A]">{helper}</p>
        </div>
        <span className="text-[22px] font-black text-[#131A2A]">{score}</span>
      </div>
      <div className="mt-4 h-2.5 rounded-full bg-[#EEF1F6]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${hexToRgba(accent, 0.45)}, ${accent})`,
          }}
        />
      </div>
    </div>
  );
}

function ResultTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors ${
        active
          ? "bg-[#121A2A] text-white shadow-[0_12px_24px_rgba(18,26,42,0.18)]"
          : "bg-[#F3F6FB] text-[#6A7488]"
      }`}
    >
      {label}
    </button>
  );
}

function ColorChipGroup({ title, description, colors }: { title: string; description: string; colors: PersonalColorSwatch[] }) {
  return (
    <section className="rounded-[28px] border border-black/6 bg-white p-5 shadow-[0_18px_50px_rgba(10,16,28,0.05)]">
      <div className="mb-4">
        <h3 className="text-[19px] font-bold text-[#121A2A]">{title}</h3>
        <p className="mt-1 text-[14px] leading-6 text-[#6C7485]">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {colors.map((color) => (
          <div key={`${title}-${color.name}`} className="rounded-[22px] border border-black/6 bg-[#F8FAFF] p-3">
            <div
              className="h-14 rounded-[16px] border border-black/6"
              style={{ backgroundColor: color.hex }}
            />
            <p className="mt-3 text-[13px] font-semibold text-[#131A2A]">{color.name}</p>
            <p className="mt-1 text-[11px] tracking-[0.08em] text-[#8E96A8] uppercase">{color.hex}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function getResultCardBackground(accent: string, surface: string) {
  return `linear-gradient(155deg, ${surface} 0%, ${hexToRgba(accent, 0.18)} 52%, rgba(255,255,255,0.98) 100%)`;
}

function buildDrapeGradient(colors: PersonalColorSwatch[]) {
  const palette = colors.slice(0, 6);
  const segments = palette.map((color, index) => {
    const start = Math.round((index / palette.length) * 100);
    const end = Math.round(((index + 1) / palette.length) * 100);
    return `${color.hex} ${start}% ${end}%`;
  });

  return `conic-gradient(from 210deg at 50% 52%, ${segments.join(", ")})`;
}

function ToneMirrorGrid({ previewSrc, result }: { previewSrc: string; result: PersonalColorSuccess }) {
  const faceCenterX = ((result.faceBox.x + (result.faceBox.width / 2)) / result.imageWidth) * 100;
  const faceCenterY = ((result.faceBox.y + (result.faceBox.height / 2)) / result.imageHeight) * 100;
  const faceWidthRatio = result.faceBox.width / result.imageWidth;
  const faceHeightRatio = result.faceBox.height / result.imageHeight;
  const zoomFromWidth = 0.74 / Math.max(faceWidthRatio, 0.01);
  const zoomFromHeight = 0.82 / Math.max(faceHeightRatio, 0.01);
  const faceZoom = clampNumber(Math.max(zoomFromWidth, zoomFromHeight) * 0.92, 1.22, 2.05);
  const faceAnchorY = clampNumber(faceCenterY - 3, 12, 88);

  return (
    <section className="rounded-[30px] border border-black/6 bg-white p-5 shadow-[0_20px_60px_rgba(12,18,32,0.06)]">
      <div className="mb-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#7B8597]">Tone Mirror</p>
        <h3 className="mt-2 text-[26px] font-black tracking-[-0.04em] text-[#121A2A]">같은 얼굴을 톤 위에 바로 올려봐요</h3>
        <p className="mt-2 text-[15px] leading-7 text-[#687286]">
          퍼스널 컬러는 설명보다 체감이 먼저여야 합니다. 같은 얼굴을 계절 팔레트 위에 올려두고 어떤 계열이 더 자연스럽게 읽히는지 바로 비교해보세요.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TONE_MIRROR_ORDER.map((season) => {
          const profile = PERSONAL_COLOR_PROFILES[season];
          const selected = season === result.season;

          return (
            <div
              key={season}
              className="relative overflow-hidden rounded-[28px] border p-3 shadow-[0_14px_35px_rgba(12,18,32,0.10)]"
              style={{
                borderColor: selected ? hexToRgba(profile.accent, 0.55) : "rgba(17, 24, 39, 0.06)",
                background: buildDrapeGradient(profile.flattering),
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_30%,rgba(17,24,39,0.14)_100%)]" />

              <div className="relative z-10 flex items-start gap-3">
                <div className="rounded-full bg-black/24 px-3 py-1.5 backdrop-blur-sm">
                  <p className="text-[12px] font-bold tracking-[0.14em] text-white uppercase">{profile.title}</p>
                </div>
              </div>

              <div
                className="absolute bottom-0 left-1/2 h-[34%] w-[94%] -translate-x-1/2 rounded-t-[999px]"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${hexToRgba(profile.accent, 0.55)} 100%)` }}
              />

              <div className="relative z-10 mt-3 flex min-h-[280px] items-end justify-center">
                <div
                  className="relative h-[235px] w-[168px] overflow-hidden rounded-[999px] border border-white/70 bg-white/18 shadow-[0_24px_50px_rgba(0,0,0,0.18)] backdrop-blur-[2px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt={`${profile.title} 톤 미리보기`}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${faceCenterX}% ${faceAnchorY}%`,
                      transform: `scale(${faceZoom})`,
                      transformOrigin: `${faceCenterX}% ${faceAnchorY}%`,
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 26%, ${hexToRgba(profile.accent, 0.16)} 100%)` }}
                  />
                </div>
              </div>

              <div className="relative z-10 mt-3 rounded-[20px] bg-black/18 px-4 py-3 backdrop-blur-sm">
                <p className="text-[13px] font-semibold leading-5 text-white/92">{profile.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function resizeImageFile(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = imageUrl;

    if (image.decode) {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      });
    }

    const maxSize = 1280;
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;

    if (width > height) {
      if (width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      }
    } else if (height > maxSize) {
      width *= maxSize / height;
      height = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("브라우저에서 이미지를 처리하지 못했습니다.");
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function PersonalColorPage() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const {
    isLoading: isPersonalColorLoading,
    isVisible: isPersonalColorVisible,
    isEnabled: isPersonalColorEnabled,
  } = usePersonalColorAvailability();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [result, setResult] = useState<PersonalColorSuccess | PersonalColorFailure | null>(null);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>("analysis");
  const [pendingStyleId, setPendingStyleId] = useState<string | null>(null);
  const { recentPhotos, savePhoto } = useRecentPhotos();
  const [pendingRecentPhoto, setPendingRecentPhoto] = useState<string | null>(null);

  const recommendedStyles = useMemo(() => {
    if (!result || result.status !== "ok") return [];
    return result.profile.recommendedStyleIds
      .map((styleId) => ALL_STYLES.find((style) => style.id === styleId))
      .filter((style): style is (typeof ALL_STYLES)[number] => Boolean(style));
  }, [result]);

  const analyzeResizedDataUrl = async (resized: string) => {
    setPreviewSrc(resized);
    savePhoto(resized);
    const analysis = await analyzePersonalColor(resized);
    setResult(analysis);
    void trackClientEvent("lab_personal_color_completed");
    setAnalysisState("done");
  };

  const handleFileSelect = async (file: File) => {
    try {
      setAnalysisState("analyzing");
      setResult(null);
      setActiveResultTab("analysis");
      const resized = await resizeImageFile(file);
      await analyzeResizedDataUrl(resized);
    } catch {
      setResult({
        status: "unsupported",
        reason: "이미지를 처리하지 못했습니다. 다른 사진으로 다시 시도해주세요.",
      });
      setAnalysisState("done");
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await handleFileSelect(file);
  };

  const openGalleryPicker = () => fileInputRef.current?.click();

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setShowCameraCapture(false);
  };

  const openCameraPicker = () => setShowCameraCapture(true);

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    stopCamera();
    try {
      setAnalysisState("analyzing");
      setResult(null);
      const resized = await resizeImageFile(
        new File([await (await fetch(canvas.toDataURL("image/jpeg", 0.9))).blob()], "personal-color-camera.jpg", {
          type: "image/jpeg",
        })
      );
      await analyzeResizedDataUrl(resized);
    } catch {
      setResult({
        status: "unsupported",
        reason: "카메라로 찍은 사진을 처리하지 못했습니다. 다시 시도해주세요.",
      });
      setAnalysisState("done");
    }
  };

  useEffect(() => {
    if (!showCameraCapture) return;
    let active = true;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!active) return;
        setShowCameraCapture(false);
        cameraInputRef.current?.click();
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [showCameraCapture]);

  const handleApplyStyle = (styleId: string) => {
    if (!previewSrc) return;
    sessionStorage.setItem("sd_styleId", styleId);
    sessionStorage.setItem("sd_variant", "default");
    sessionStorage.setItem("sd_imageBase64", previewSrc.split(",")[1] ?? "");
    sessionStorage.setItem("sd_previewDataUrl", previewSrc);
    sessionStorage.removeItem("sd_resultDataUrl");
    sessionStorage.removeItem("sd_shareUrl");
    sessionStorage.removeItem("sd_shareLink");
    sessionStorage.setItem("sd_fromStudio", "1");
    router.push("/result");
  };

  const pendingStyle = pendingStyleId
    ? ALL_STYLES.find((style) => style.id === pendingStyleId) ?? null
    : null;

  if (isPersonalColorLoading || authLoading) {
    return (
      <main className="min-h-screen bg-[#F5F7FC] text-[#131A2A]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
          <div className="rounded-[28px] border border-[#DCE2EF] bg-white px-6 py-8 text-center shadow-[0_20px_60px_rgba(12,18,32,0.06)]">
            <span className="mx-auto inline-flex h-11 w-11 animate-spin rounded-full border-[3px] border-[#DDE4F2] border-t-[#315EFB]" />
            <p className="mt-4 text-[15px] font-semibold text-[#465067]">퍼스널 컬러 실험실 상태를 확인 중이에요</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F5F7FC] text-[#131A2A]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-14 pt-5 sm:px-6">
          <header className="mb-5 flex items-center justify-between">
            <Link href="/studio" className="flex items-center gap-2 text-[14px] font-semibold text-[#465067]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11.25 4.5L6.75 9L11.25 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              실험실로 돌아가기
            </Link>
          </header>
          <section className="my-auto rounded-[32px] border border-[#DCE2EF] bg-white px-6 py-8 shadow-[0_30px_80px_rgba(12,18,32,0.08)] sm:px-7 sm:py-9">
            <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#C9571A]">AI Personal Color</p>
            <h1 className="mt-3 text-[32px] font-black leading-[1.08] tracking-[-0.04em] text-[#111827]">
              로그인 후
              <br />
              이용할 수 있어요
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#677084]">
              실험실 카드는 카카오 로그인 후 이용합니다. 분석 완료 기록과 추천 흐름을 계정 기준으로 관리하기 위한 처리입니다.
            </p>
            <button
              type="button"
              onClick={() => login("/personal-color")}
              className="mt-6 inline-flex h-14 items-center justify-center rounded-[20px] bg-[#FEE500] px-5 py-3 text-[15px] font-black text-[#191919]"
            >
              카카오로 계속하기
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (!isPersonalColorVisible || !isPersonalColorEnabled) {
    return (
      <main className="min-h-screen bg-[#F5F7FC] text-[#131A2A]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-14 pt-5 sm:px-6">
          <header className="mb-5 flex items-center justify-between">
            <Link href="/studio" className="flex items-center gap-2 text-[14px] font-semibold text-[#465067]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11.25 4.5L6.75 9L11.25 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              실험실로 돌아가기
            </Link>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-[#6E7890] shadow-sm">
              PERSONAL COLOR LAB
            </span>
          </header>

          <section className="rounded-[32px] border border-[#DCE2EF] bg-white px-6 py-8 shadow-[0_30px_80px_rgba(12,18,32,0.08)] sm:px-7 sm:py-9">
            <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#C9571A]">AI Personal Color</p>
            <h1 className="mt-3 text-[32px] font-black leading-[1.08] tracking-[-0.04em] text-[#111827]">
              지금은 잠시
              <br />
              점검 중이에요
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#677084]">
              어드민에서 현재 퍼스널 컬러 실험실 진입 또는 생성을 중지한 상태입니다. 잠시 후 다시 확인해주세요.
            </p>
            <Link
              href="/studio"
              className="mt-6 inline-flex items-center justify-center rounded-[20px] bg-[#121A2A] px-5 py-3 text-[15px] font-bold text-white"
            >
              Studio로 돌아가기
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FC] text-[#131A2A]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-14 pt-5 sm:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/studio" className="flex items-center gap-2 text-[14px] font-semibold text-[#465067]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11.25 4.5L6.75 9L11.25 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            실험실로 돌아가기
          </Link>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-[#6E7890] shadow-sm">
            PERSONAL COLOR LAB
          </span>
        </header>

        <section className="relative overflow-hidden rounded-[32px] border border-[#DCE2EF] bg-white px-5 py-6 shadow-[0_30px_80px_rgba(12,18,32,0.08)] sm:px-7 sm:py-7">
          <div
            className="pointer-events-none absolute -right-14 top-[-40px] h-48 w-48 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,146,119,0.26) 0%, rgba(255,146,119,0) 72%)" }}
          />
          <div
            className="pointer-events-none absolute -left-10 bottom-[-48px] h-44 w-44 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(101,148,255,0.22) 0%, rgba(101,148,255,0) 70%)" }}
          />

          <p className="relative text-[12px] font-bold uppercase tracking-[0.24em] text-[#C9571A]">AI Personal Color</p>
          <h1 className="relative mt-3 text-[34px] font-black leading-[1.06] tracking-[-0.04em] text-[#111827] sm:text-[42px]">
            셀카 한 장으로
            <br />
            내 톤을 추정해봐요
          </h1>
          <p className="relative mt-4 max-w-xl text-[15px] leading-7 text-[#677084]">
            셀카 한 장으로 웜/쿨, 밝기, 선명도를 읽고
            지금 얼굴에 잘 맞는 StyleDrop 필터까지 바로 추천해드려요.
          </p>

          <div className="relative mt-5 flex flex-wrap gap-2">
            {["정면 얼굴", "자연광 권장", "필터 없는 원본", "진한 메이크업 피하기"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#DCE2EF] bg-[#F7F9FD] px-3 py-2 text-[12px] font-semibold text-[#5F6880]"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileChange}
        />

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-[#DCE2EF] bg-white p-4 shadow-[0_22px_70px_rgba(12,18,32,0.06)] sm:p-5">
            {previewSrc ? (
              <>
                <div className="relative overflow-hidden rounded-[24px] border border-black/6 bg-[#EEF2F8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewSrc} alt="퍼스널 컬러 분석 업로드 사진" className="block w-full h-auto" />

                  {result?.status === "ok" && result.samples.map((sample) => (
                    <div
                      key={sample.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${(sample.x / result.imageWidth) * 100}%`,
                        top: `${(sample.y / result.imageHeight) * 100}%`,
                      }}
                    >
                      <div
                        className="absolute left-1/2 top-1/2 rounded-full border border-white/85 shadow-[0_8px_20px_rgba(0,0,0,0.14)]"
                        style={{
                          width: `${(sample.radius * 2 / result.imageWidth) * 100}%`,
                          paddingBottom: `${(sample.radius * 2 / result.imageWidth) * 100}%`,
                          minWidth: "18px",
                          minHeight: "18px",
                          transform: "translate(-50%, -50%)",
                          backgroundColor: sample.color,
                        }}
                      />
                      <span className="absolute left-1/2 top-[calc(100%+10px)] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#121A2A] px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
                        {sample.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[22px] bg-[#F7F9FD] px-4 py-3">
                  <div>
                    <p className="text-[12px] font-semibold tracking-[0.14em] text-[#8993A6] uppercase">업로드 상태</p>
                    <p className="mt-1 text-[15px] font-bold text-[#131A2A]">
                      {analysisState === "analyzing" ? "피부톤과 얼굴 포인트를 분석 중이에요" : "새 사진으로 다시 분석할 수 있어요"}
                    </p>
                  </div>
                  {/* 최근 사용한 셀카 */}
                  {recentPhotos.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[11px] font-bold tracking-wider text-[#8993A6] uppercase">최근 셀카</p>
                      <div className="flex gap-2">
                        {recentPhotos.map((photo, i) => (
                          <button
                            key={i}
                            onClick={() => setPendingRecentPhoto(photo)}
                            className="relative flex-shrink-0 overflow-hidden rounded-xl border-2 border-[#D4DBE8] hover:border-[#315EFB] transition-colors"
                            style={{ width: 56, height: 56 }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={openGalleryPicker}
                      className="rounded-full border border-[#D4DBE8] bg-white px-4 py-2 text-[13px] font-semibold text-[#465067]"
                    >
                      앨범에서 다시 선택
                    </button>
                    <button
                      onClick={openCameraPicker}
                      className="rounded-full bg-[#121A2A] px-4 py-2 text-[13px] font-semibold text-white"
                    >
                      지금 셀카 다시 찍기
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#D9E0EC] bg-[#FAFBFE] px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 18.667V7M14 7L9.333 11.667M14 7L18.667 11.667M5.833 20.417V20.806C5.833 21.7725 6.6165 22.556 7.58301 22.556H20.417C21.3835 22.556 22.167 21.7725 22.167 20.806V20.417" stroke="#4D5A73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="mt-6 text-[24px] font-black text-[#131A2A]">정면 셀카를 올려주세요</h2>
                <p className="mt-3 max-w-sm text-[15px] leading-7 text-[#687286]">
                  얼굴이 프레임을 적당히 채우는 사진이면 좋습니다. 업로드 후 바로 웜/쿨, 밝기, 선명도 추정을 시작합니다.
                </p>
                {/* 최근 사용한 셀카 */}
                {recentPhotos.length > 0 && (
                  <div className="mt-5 w-full max-w-sm">
                    <p className="mb-2 text-[11px] font-bold tracking-wider text-[#8993A6] uppercase">최근 사용한 셀카</p>
                    <div className="flex gap-2.5 justify-center">
                      {recentPhotos.map((photo, i) => (
                        <button
                          key={i}
                          onClick={() => setPendingRecentPhoto(photo)}
                          className="relative flex-shrink-0 overflow-hidden rounded-2xl border-2 border-[#D4DBE8] hover:border-[#315EFB] transition-colors"
                          style={{ width: 76, height: 76 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-[#E9EDF5]" />
                  </div>
                )}

                <div className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                  <button
                    onClick={openGalleryPicker}
                    className="flex-1 rounded-[20px] border border-[#D4DBE8] bg-white px-5 py-3 text-[15px] font-bold text-[#243047]"
                  >
                    앨범에서 선택
                  </button>
                  <button
                    onClick={openCameraPicker}
                    className="flex-1 rounded-[20px] bg-[#121A2A] px-5 py-3 text-[15px] font-bold text-white"
                  >
                    지금 셀카 찍기
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {analysisState === "analyzing" && (
              <section className="rounded-[28px] border border-[#DCE2EF] bg-white p-6 shadow-[0_20px_60px_rgba(12,18,32,0.06)]">
                <div className="flex items-center gap-4">
                  <span className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#DDE4F2] border-t-[#315EFB]" />
                  <div>
                    <h2 className="text-[20px] font-bold text-[#131A2A]">톤을 읽고 있어요</h2>
                    <p className="mt-1 text-[14px] leading-6 text-[#6B7488]">
                      이마와 양볼 피부 샘플을 기준으로 밝기, 온도감, 선명도를 계산하고 있습니다.
                    </p>
                  </div>
                </div>
              </section>
            )}

      {result?.status === "ok" && (
              <>
                <ToneMirrorGrid previewSrc={previewSrc!} result={result} />

                <section className="rounded-[30px] border border-black/6 bg-white p-5 shadow-[0_20px_60px_rgba(12,18,32,0.06)]">
                  <div className="mb-5">
                    <p className="text-[12px] font-bold tracking-[0.2em] text-[#7D8799] uppercase">Result Tabs</p>
                    <h3 className="mt-2 text-[26px] font-black tracking-[-0.04em] text-[#121A2A]">분석 내용을 탭으로 나눠서 볼게요</h3>
                    <p className="mt-2 text-[15px] leading-7 text-[#687286]">
                      핵심만 빠르게 보이도록 하단 리포트를 탭 형식으로 정리했습니다. 먼저 `톤 분석`에서 AI가 읽은 방향부터 확인해보세요.
                    </p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <ResultTabButton label="톤 분석" active={activeResultTab === "analysis"} onClick={() => setActiveResultTab("analysis")} />
                    <ResultTabButton label="컬러칩" active={activeResultTab === "palette"} onClick={() => setActiveResultTab("palette")} />
                    <ResultTabButton label="메이크업" active={activeResultTab === "makeup"} onClick={() => setActiveResultTab("makeup")} />
                    <ResultTabButton label="추천 필터" active={activeResultTab === "styles"} onClick={() => setActiveResultTab("styles")} />
                  </div>

                  <div className="mt-5">
                    {activeResultTab === "analysis" && (
                      <div className="space-y-4">
                        <section
                          className="overflow-hidden rounded-[32px] border border-black/6 p-6 shadow-[0_28px_80px_rgba(12,18,32,0.08)]"
                          style={{ background: getResultCardBackground(result.profile.accent, result.profile.surface) }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-[12px] font-bold tracking-[0.2em] text-[#7D8799] uppercase">Personal Color Report</p>
                              <h2 className="mt-3 text-[34px] font-black tracking-[-0.05em] text-[#121A2A]">{result.profile.title}</h2>
                              <p className="mt-2 text-[17px] font-bold text-[#2E3A55]">{result.summaryLine}</p>
                              <p className="mt-3 max-w-lg text-[15px] leading-7 text-[#5D667A]">{result.profile.summary}</p>
                            </div>
                            <div className="rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 text-right shadow-sm backdrop-blur">
                              <p className="text-[11px] font-bold tracking-[0.18em] text-[#8A93A4] uppercase">피부 샘플 평균</p>
                              <div className="mt-3 flex items-center justify-end gap-3">
                                <span className="h-12 w-12 rounded-full border border-black/6" style={{ backgroundColor: result.averageHex }} />
                                <div>
                                  <p className="text-[20px] font-black text-[#121A2A]">{result.averageHex}</p>
                                  <p className="mt-1 text-[13px] text-[#6C7487]">{result.profile.subtitle}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="grid gap-4 sm:grid-cols-3">
                          <AxisMeter label="밝기" score={result.brightness.score} helper={result.brightness.label} accent={result.profile.accent} />
                          <AxisMeter label="온도감" score={result.temperature.score} helper={result.temperature.label} accent={result.profile.accent} />
                          <AxisMeter label="선명도" score={result.clarity.score} helper={result.clarity.label} accent={result.profile.accent} />
                        </section>
                      </div>
                    )}

                    {activeResultTab === "palette" && (
                      <div className="space-y-4">
                        <ColorChipGroup
                          title="잘 받는 컬러"
                          description="이 계열은 얼굴을 더 맑고 자연스럽게 정리해줄 가능성이 높아요."
                          colors={result.profile.flattering}
                        />
                        <ColorChipGroup
                          title="덜 어울릴 수 있는 컬러"
                          description="이 계열은 얼굴이 탁해 보이거나 노랗게 떠 보일 수 있어요."
                          colors={result.profile.avoid}
                        />
                      </div>
                    )}

                    {activeResultTab === "makeup" && (
                      <section className="rounded-[28px] border border-black/6 bg-white p-5 shadow-[0_18px_50px_rgba(10,16,28,0.05)]">
                        <div className="mb-4">
                          <h3 className="text-[19px] font-bold text-[#121A2A]">메이크업 추천</h3>
                          <p className="mt-1 text-[14px] leading-6 text-[#6C7485]">
                            립, 블러셔, 헤어 톤도 이 결로 맞추면 전체 인상이 훨씬 안정적으로 보일 수 있어요.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <ColorChipGroup title="립" description="입술 컬러" colors={result.profile.lip} />
                          <ColorChipGroup title="블러셔" description="볼 컬러" colors={result.profile.blush} />
                          <ColorChipGroup title="헤어" description="염색 컬러" colors={result.profile.hair} />
                        </div>
                      </section>
                    )}

                    {activeResultTab === "styles" && (
                      <section className="rounded-[28px] border border-black/6 bg-white p-5 shadow-[0_18px_50px_rgba(10,16,28,0.05)]">
                        <div className="mb-4">
                          <h3 className="text-[19px] font-bold text-[#121A2A]">StyleDrop 추천 필터</h3>
                          <p className="mt-1 text-[14px] leading-6 text-[#6C7485]">
                            지금 읽힌 톤과 결이 비교적 잘 맞는 필터를 바로 골랐습니다.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          {recommendedStyles.map((style) => (
                            <div key={style.id} className="overflow-hidden rounded-[24px] border border-black/6 bg-[#F7F9FD]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={style.afterImg} alt={style.name} className="h-44 w-full object-cover" />
                              <div className="p-4">
                                <p className="text-[15px] font-bold text-[#121A2A]">{style.name}</p>
                                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#697386]">{style.desc}</p>
                                <button
                                  onClick={() => setPendingStyleId(style.id)}
                                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#121A2A] px-4 py-3 text-[14px] font-bold text-white"
                                >
                                  <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[12px] font-black text-[#FFB38D]">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                      <path d="M6 1.25L7.238 4.024L10.25 4.297L7.986 6.249L8.641 9.188L6 7.665L3.359 9.188L4.014 6.249L1.75 4.297L4.762 4.024L6 1.25Z" fill="currentColor" />
                                    </svg>
                                    1크레딧
                                  </span>
                                  <span>변환해보기</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </section>

                <p className="px-1 text-[13px] leading-6 text-[#788094]">
                  조명, 카메라 화이트밸런스, 메이크업 상태에 따라 결과는 달라질 수 있습니다. 이 기능은 전문가 대면 진단을 대체하지 않습니다.
                </p>
              </>
            )}

            {result && result.status !== "ok" && analysisState === "done" && (
              <section className="rounded-[28px] border border-[#E5D4D4] bg-[#FFF8F7] p-6 shadow-[0_18px_50px_rgba(12,18,32,0.05)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#F6E0DE] text-[#C9571A]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 5.333V8.667M8 11.333H8.007M14 8A6 6 0 112 8a6 6 0 0112 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-[#131A2A]">다시 한 번 찍어보는 게 좋겠어요</h2>
                    <p className="mt-2 text-[15px] leading-7 text-[#5E677A]">{result.reason}</p>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={openGalleryPicker}
                        className="rounded-[18px] border border-[#D4DBE8] bg-white px-5 py-3 text-[14px] font-bold text-[#465067]"
                      >
                        다른 사진 선택
                      </button>
                      <button
                        onClick={openCameraPicker}
                        className="rounded-[18px] bg-[#121A2A] px-5 py-3 text-[14px] font-bold text-white"
                      >
                        지금 셀카 다시 찍기
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </section>
      </div>

      {showCameraCapture && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          <div className="flex items-center justify-between px-5 pb-4 pt-12">
            <button onClick={stopCamera} className="text-[14px] text-white/60">취소</button>
            <p className="text-[15px] font-bold text-white">셀카 찍기</p>
            <div className="w-12" />
          </div>

          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              <defs>
                <mask id="personal-color-face-mask">
                  <rect width="100" height="100" fill="white" />
                  <ellipse cx="50" cy="43" rx="28" ry="36" fill="black" />
                </mask>
              </defs>
              <rect width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#personal-color-face-mask)" />
              <ellipse cx="50" cy="43" rx="28" ry="36" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.95" />
            </svg>
            <div className="absolute bottom-6 left-0 right-0 text-center">
              <p className="text-[13px] font-medium text-white/85 drop-shadow-lg">얼굴을 타원 안에 맞추고 정면으로 찍어주세요</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 bg-black pb-14 pt-6">
            <button
              onClick={captureFromCamera}
              className="h-20 w-20 rounded-full border-4 border-white/30 bg-white shadow-2xl transition-transform active:scale-95"
            />
            <button
              onClick={() => {
                stopCamera();
                openGalleryPicker();
              }}
              className="text-[13px] text-white/55"
            >
              앨범에서 선택
            </button>
          </div>
        </div>
      )}

      {/* 최근 셀카 확인 모달 */}
      {pendingRecentPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-5"
          onClick={() => setPendingRecentPhoto(null)}
        >
          <div
            className="w-full max-w-xs rounded-[28px] bg-white p-5 flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl" style={{ aspectRatio: "1/1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingRecentPhoto} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="text-center">
              <p className="text-[#131A2A] font-bold text-[17px]">이 사진으로 분석할까요?</p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingRecentPhoto(null)}
                className="flex-1 py-3.5 rounded-2xl bg-[#F3F4F6] text-[#6B7280] font-bold text-[15px]"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const photo = pendingRecentPhoto;
                  setPendingRecentPhoto(null);
                  setAnalysisState("analyzing");
                  setResult(null);
                  setActiveResultTab("analysis");
                  void analyzeResizedDataUrl(photo);
                }}
                className="flex-[1.4] py-3.5 rounded-2xl bg-[#121A2A] text-white font-bold text-[15px]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingStyle && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4"
          onClick={() => setPendingStyleId(null)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(12,18,32,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8A94A8]">Credit Confirm</p>
                <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-[#121A2A]">{pendingStyle.name}</h3>
              </div>
              <span className="rounded-full bg-[#FFF1E8] px-3 py-2 text-[12px] font-black text-[#C9571A]">
                1크레딧
              </span>
            </div>

            <p className="mt-4 text-[15px] leading-7 text-[#667085]">
              이 필터를 적용하면 <span className="font-bold text-[#121A2A]">1크레딧이 차감</span>되고,
              바로 AI 변환이 시작됩니다.
            </p>

            <div className="mt-5 overflow-hidden rounded-[20px] border border-black/6 bg-[#F7F9FD]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingStyle.afterImg} alt={pendingStyle.name} className="h-36 w-full object-cover" />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPendingStyleId(null)}
                className="flex-1 rounded-[18px] border border-[#D6DDE9] bg-white px-4 py-3 text-[14px] font-bold text-[#516078]"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const styleId = pendingStyle.id;
                  setPendingStyleId(null);
                  handleApplyStyle(styleId);
                }}
                className="flex-1 rounded-[18px] bg-[#121A2A] px-4 py-3 text-[14px] font-bold text-white"
              >
                1크레딧 사용하고 계속
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
