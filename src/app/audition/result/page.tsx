"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Scores = { 이해도: number; 표정연기: number; 창의성: number; 몰입도: number };

type SceneResult = {
  genre: string;
  critique: string;
  assigned_role: string;
  style_prompt: string;
  scores: Scores;
};

type AuditionResult = {
  scenes: SceneResult[];
  overall_critique: string;
};

type GenreMeta = { genre: string; cue: string };
type Phase = "generating" | "ready" | "error";

const GENRE_EMOJIS: Record<string, string> = {
  멜로: "💔", 스릴러: "🔪", 일상: "😐", 공포: "👻", 코미디: "😂", 액션: "💥",
  판타지: "✨", 범죄: "🕵️", 로맨스: "🌹", 심리: "🧠",
};

const SCORE_LABELS = ["이해도", "표정연기", "창의성", "몰입도"] as const;

function scoreColor(v: number) {
  if (v >= 70) return "#4ade80";
  if (v >= 45) return "#f97316";
  return "#ef4444";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#555] w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
        />
      </div>
      <span className="text-[11px] font-bold w-7 text-right" style={{ color: scoreColor(value) }}>{value}</span>
    </div>
  );
}

// ── Canvas 합성 저장 ──────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy + lineHeight;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// 단일 씬 저장 (탭별)
async function buildSceneSaveCanvas(
  scene: SceneResult,
  sceneIdx: number,
  userPhoto: string | null,
  stillImage: string | null,
  genreMeta: GenreMeta | null
): Promise<Blob> {
  const W = 640;
  const PAD = 24;
  const PHOTO_SIZE = (W - PAD * 3) / 2; // 정사각형
  const HEADER_H = 80;
  const PHOTOS_H = PHOTO_SIZE + 20; // 라벨 포함
  const ROLE_H = 70;
  const CRITIQUE_H = 100;
  const SCORES_H = 120;
  const FOOTER_H = 56;
  const H = HEADER_H + PHOTOS_H + ROLE_H + CRITIQUE_H + SCORES_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, W, H);

  const emoji = GENRE_EMOJIS[scene.genre] ?? "🎬";

  // 장르 헤더
  ctx.fillStyle = "#C9571A";
  ctx.font = "bold 16px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${emoji} ${scene.genre} · SCENE ${sceneIdx + 1}`, W / 2, 38);

  // 큐 텍스트
  ctx.fillStyle = "#666";
  ctx.font = "12px -apple-system, sans-serif";
  const cueText = genreMeta ? `"${genreMeta.cue}"` : "";
  if (cueText.length > 50) {
    ctx.fillText(cueText.slice(0, 50) + "...", W / 2, 60);
  } else {
    ctx.fillText(cueText, W / 2, 60);
  }

  // 사진 라벨
  const PHOTO_Y = HEADER_H;
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.fillStyle = "#444";
  ctx.textAlign = "center";
  ctx.fillText("내 연기", PAD + PHOTO_SIZE / 2, PHOTO_Y);
  ctx.fillStyle = "#C9571A";
  ctx.fillText("AI 스틸컷", PAD * 2 + PHOTO_SIZE + PHOTO_SIZE / 2, PHOTO_Y);

  const IMG_Y = PHOTO_Y + 14;

  // 사진 배경
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.roundRect(PAD, IMG_Y, PHOTO_SIZE, PHOTO_SIZE, 12); ctx.fill();
  ctx.beginPath(); ctx.roundRect(PAD * 2 + PHOTO_SIZE, IMG_Y, PHOTO_SIZE, PHOTO_SIZE, 12); ctx.fill();

  try {
    if (userPhoto) {
      const img = await loadImage(userPhoto);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(PAD, IMG_Y, PHOTO_SIZE, PHOTO_SIZE, 12); ctx.clip();
      ctx.drawImage(img, PAD, IMG_Y, PHOTO_SIZE, PHOTO_SIZE);
      ctx.restore();
    }
  } catch { /* skip */ }

  try {
    if (stillImage) {
      const img = await loadImage(stillImage);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(PAD * 2 + PHOTO_SIZE, IMG_Y, PHOTO_SIZE, PHOTO_SIZE, 12); ctx.clip();
      ctx.drawImage(img, PAD * 2 + PHOTO_SIZE, IMG_Y, PHOTO_SIZE, PHOTO_SIZE);
      ctx.restore();
    }
  } catch { /* skip */ }

  // 배정 단역
  const ROLE_Y = IMG_Y + PHOTO_SIZE + 20;
  ctx.fillStyle = "#C9571A";
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("배정 단역", PAD, ROLE_Y);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 17px -apple-system, sans-serif";
  wrapText(ctx, scene.assigned_role, PAD, ROLE_Y + 18, W - PAD * 2, 22);

  // 감독 한마디
  const CRIT_Y = ROLE_Y + ROLE_H;
  ctx.fillStyle = "#C9571A";
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.fillText("🎬 감독의 한마디", PAD, CRIT_Y);
  ctx.fillStyle = "#aaa";
  ctx.font = "12px -apple-system, sans-serif";
  wrapText(ctx, scene.critique, PAD, CRIT_Y + 18, W - PAD * 2, 18);

  // 점수
  const SCORE_Y = CRIT_Y + CRITIQUE_H;
  ctx.fillStyle = "#444";
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.fillText("연기 점수", PAD, SCORE_Y);
  SCORE_LABELS.forEach((label, si) => {
    const val = scene.scores?.[label] ?? 0;
    const sy = SCORE_Y + 16 + si * 22;
    ctx.fillStyle = "#555";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText(label, PAD, sy + 8);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(PAD + 40, sy, W - PAD * 2 - 70, 7);
    ctx.fillStyle = scoreColor(val);
    ctx.fillRect(PAD + 40, sy, (W - PAD * 2 - 70) * (val / 100), 7);
    ctx.font = "bold 10px -apple-system, sans-serif";
    ctx.fillText(String(val), W - PAD - 20, sy + 8);
  });

  // 푸터
  ctx.fillStyle = "#111";
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = "#C9571A";
  ctx.font = "bold 14px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("StyleDrop AI 오디션", W / 2, H - FOOTER_H / 2 + 5);

  return new Promise(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.93));
}

// ── 총평 탭 컴포넌트 ──────────────────────────────────────────────
function OverallTab({
  result,
  userPhotos,
  stillImages,
}: {
  result: AuditionResult;
  userPhotos: string[];
  stillImages: (string | null)[];
}) {
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    setStamped(false);
    const t = setTimeout(() => setStamped(true), 900);
    return () => clearTimeout(t);
  }, []);

  const avgScore = Math.round(
    result.scenes.reduce((sum, s) => {
      const vals = SCORE_LABELS.map(l => s.scores?.[l] ?? 0);
      return sum + vals.reduce((a, b) => a + b, 0) / vals.length;
    }, 0) / result.scenes.length
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 이력서 카드 */}
      <div
        className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{
          background: "linear-gradient(135deg, #1a1410 0%, #0f0d0a 50%, #1a1410 100%)",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* 종이 질감 노이즈 */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }} />

        <div className="relative px-6 py-6">
          {/* 헤더 */}
          <div className="border-b border-white/10 pb-4 mb-6">
            <p className="text-[10px] text-[#666] font-bold tracking-[0.25em] uppercase mb-2">CASTING DOCUMENT · 2026</p>
            <h2 className="text-[20px] font-extrabold text-white leading-tight mb-2">오디션 지원서</h2>
            <p className="text-[14px] text-[#C9571A] font-bold">
              지원 배역: {result.scenes[0]?.assigned_role}
            </p>
          </div>

          {/* 증명사진 + 도장 */}
          <div className="flex gap-5 mb-6">
            <div className="relative w-32 h-40 shrink-0">
              {/* 증명사진 프레임 */}
              <div className="w-full h-full border-2 border-white/15 bg-[#0a0a0a] overflow-hidden">
                {userPhotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userPhotos[0]} alt="증명사진" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#333] text-[10px]">사진 없음</div>
                )}
              </div>
              {/* 불합격 도장 */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  opacity: stamped ? 1 : 0,
                  transform: stamped ? "scale(1) rotate(-18deg)" : "scale(3) rotate(-18deg)",
                  transition: stamped ? "opacity 0.08s ease-out, transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275)" : "none",
                }}
              >
                <div
                  className="px-3 py-1.5 border-[3px] border-[#dc2626] rounded"
                  style={{
                    color: "#dc2626",
                    fontFamily: "sans-serif",
                    fontWeight: 900,
                    fontSize: "18px",
                    letterSpacing: "0.05em",
                    textShadow: "0 0 8px rgba(220,38,38,0.5)",
                    boxShadow: "0 0 10px rgba(220,38,38,0.3)",
                    opacity: 0.92,
                  }}
                >
                  불합격
                </div>
              </div>
            </div>

            {/* 지원 정보 */}
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <p className="text-[10px] text-[#666] font-bold tracking-widest uppercase mb-1">종합 점수</p>
                <p className="text-[32px] font-extrabold leading-none" style={{ color: scoreColor(avgScore) }}>
                  {avgScore}<span className="text-[15px] text-[#666] ml-2">/ 100</span>
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {result.scenes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[12px]">{GENRE_EMOJIS[s.genre] ?? "🎬"}</span>
                    <span className="text-[12px] text-[#888] font-medium">{s.genre}</span>
                    <span className="text-[12px] font-bold text-[#666]">→</span>
                    <span className="text-[12px] text-[#999] break-all">{s.assigned_role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 장르별 사진 (일상, 스릴러, 액션) */}
          <div className="border-t border-white/8 pt-5 mb-5">
            <p className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest mb-4">🎬 장르별 연기</p>
            <div className="grid grid-cols-3 gap-3">
              {result.scenes.map((scene, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p className="text-[11px] font-bold text-[#666] text-center">{scene.genre}</p>
                  <div className="relative rounded-lg overflow-hidden border border-white/8 aspect-square bg-[#0f0f0f]">
                    {stillImages[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={stillImages[i]!} alt={scene.genre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#333] text-[10px]">로딩</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 총평 */}
          <div className="border-t border-white/8 pt-5">
            <p className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest mb-3">🎬 감독 총평</p>
            <p className="text-[#aaa] text-[14px] leading-[2]">{result.overall_critique}</p>
          </div>

          {/* 최종 도장 줄 */}
          <div className="mt-5 border-t border-white/5 pt-4 flex items-center justify-between">
            <p className="text-[10px] text-[#444] font-mono">STYLEDROP CASTING DEPT.</p>
            <p className="text-[10px] text-[#444] font-mono">2026. 04.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function AuditionResult() {
  const [result, setResult] = useState<AuditionResult | null>(null);
  const [userPhotos, setUserPhotos] = useState<string[]>([]);
  const [stillImages, setStillImages] = useState<(string | null)[]>([null, null, null]);
  const [genres, setGenres] = useState<GenreMeta[]>([]);
  const [phase, setPhase] = useState<Phase>("generating");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0~2 = 씬, 3 = 총평
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const stillImagesRef = useRef<(string | null)[]>([null, null, null]);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("sd_au_result");
    const imagesRaw = sessionStorage.getItem("sd_au_images");
    const genreRaw = sessionStorage.getItem("sd_au_genres");

    if (!raw) { router.replace("/audition/solo"); return; }
    try {
      const parsed: AuditionResult = JSON.parse(raw);
      setResult(parsed);
      if (genreRaw) setGenres(JSON.parse(genreRaw));

      const photos: string[] = imagesRaw ? JSON.parse(imagesRaw) : [];
      setUserPhotos(photos);

      const base64List = photos.map(p => p.split(",")[1]).filter(Boolean);
      if (base64List.length !== 3) {
        setErrorMsg("촬영 이미지를 찾을 수 없어요.");
        setPhase("error");
        return;
      }

      const stylePrompts = parsed.scenes.map(s => s.style_prompt);

      fetch("/api/audition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: base64List, mimeType: "image/jpeg", stylePrompts }),
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "생성 실패");
          const dataUrls = (data.images as string[]).map(
            (b64: string) => `data:image/jpeg;base64,${b64}`
          );
          stillImagesRef.current = dataUrls;
          setStillImages(dataUrls);
          setPhase("ready");
        })
        .catch(err => {
          setErrorMsg(err.message ?? "스틸컷 생성에 실패했어요.");
          setPhase("error");
        });
    } catch {
      router.replace("/audition/solo");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOverall = activeTab === 3;

  const handleSave = useCallback(async () => {
    if (!result || isSaving) return;
    setIsSaving(true);
    try {
      let blob: Blob;
      let filename: string;
      if (isOverall) {
        // 총평 탭 — 현재 화면을 html2canvas 없이 씬 3개 세로 합성
        const scenes = result.scenes;
        const blobs = await Promise.all(
          scenes.map((s, i) => buildSceneSaveCanvas(
            s, i,
            userPhotos[i] ?? null,
            stillImagesRef.current[i],
            genres[i] ?? null
          ))
        );
        // 3장을 세로로 합칩니다
        const images = await Promise.all(blobs.map(b => loadImage(URL.createObjectURL(b))));
        const W = images[0].width;
        const H = images.reduce((s, img) => s + img.height, 0) + 8;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#0A0A0A";
        ctx.fillRect(0, 0, W, H);
        let y = 0;
        for (const img of images) { ctx.drawImage(img, 0, y); y += img.height + 4; }
        blob = await new Promise(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.92));
        filename = "styledrop_audition_all.jpg";
      } else {
        const sceneIdx = activeTab;
        blob = await buildSceneSaveCanvas(
          result.scenes[sceneIdx],
          sceneIdx,
          userPhotos[sceneIdx] ?? null,
          stillImagesRef.current[sceneIdx],
          genres[sceneIdx] ?? null
        );
        filename = `styledrop_${result.scenes[sceneIdx].genre}_scene${sceneIdx + 1}.jpg`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("save error", e);
    } finally {
      setIsSaving(false);
    }
  }, [result, isSaving, userPhotos, genres, activeTab, isOverall]);

  const handleKakaoShare = () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Kakao = (window as any).Kakao;
      if (!Kakao?.isInitialized()) {
        Kakao?.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      }
      const scene = result?.scenes[activeTab < 3 ? activeTab : 0];
      Kakao?.Share?.sendDefault({
        objectType: "text",
        text: `AI 감독이 나한테 "${scene?.assigned_role}" 역할을 줬어 😂\nStyleDrop AI 오디션에서 내 연기력 테스트해봐`,
        link: {
          mobileWebUrl: window.location.origin + "/audition/solo",
          webUrl: window.location.origin + "/audition/solo",
        },
      });
    } catch {
      navigator.clipboard?.writeText(window.location.origin + "/audition/solo");
    } finally {
      setIsSharing(false);
    }
  };

  if (!result) return null;

  // ── GENERATING ──────────────────────────────────────────────────────
  if (phase === "generating") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes dot-bounce { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
        `}</style>
        <div className="relative w-28 h-28">
          {userPhotos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userPhotos[0]} alt="" className="w-28 h-28 rounded-2xl object-cover border border-white/10 opacity-40" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-4 border-transparent border-t-[#C9571A] border-r-[#C9571A]/30" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        </div>
        <div>
          <p className="text-[#C9571A] text-[11px] font-bold tracking-[0.2em] uppercase mb-2">🎬 스틸컷 제작 중</p>
          <p className="text-white font-bold text-[18px] leading-snug">감독님이 배역을<br />결정하고 있습니다...</p>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C9571A]" style={{ animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-[40px]">😵</p>
        <p className="text-white font-bold text-[18px]">오디션이 중단됐습니다</p>
        <p className="text-[#888] text-[14px]">{errorMsg}</p>
        <Link href="/studio" className="text-[13px] text-[#444] hover:text-white transition-colors">밖으로 나가기</Link>
      </div>
    );
  }

  // ── READY ────────────────────────────────────────────────────────────
  const scene = !isOverall ? result.scenes[activeTab] : null;
  const userPhoto = !isOverall ? (userPhotos[activeTab] ?? null) : null;
  const stillImage = !isOverall ? (stillImages[activeTab] ?? null) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} 97%{opacity:0.8} 98%{opacity:1} }
        @keyframes slide-in { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
        .scene-content { animation: slide-in 0.2s ease-out; }
      `}</style>

      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 sticky top-0 z-40">
        <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        <span className="ml-3 text-[11px] text-[#444] font-bold uppercase tracking-widest">AI 오디션 결과</span>
      </header>

      {/* 탭 — 장르 3개 + 총평 */}
      <div className="flex border-b border-[#1a1a1a] sticky top-[52px] z-30 bg-[#0A0A0A]">
        {result.scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors border-b-2 ${
              activeTab === i ? "border-[#C9571A] text-white" : "border-transparent text-[#444] hover:text-[#777]"
            }`}
          >
            <span className="text-[18px]">{GENRE_EMOJIS[s.genre] ?? "🎬"}</span>
            <span className="text-[10px] font-bold">{s.genre}</span>
          </button>
        ))}
        <button
          onClick={() => setActiveTab(3)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors border-b-2 ${
            activeTab === 3 ? "border-[#C9571A] text-white" : "border-transparent text-[#444] hover:text-[#777]"
          }`}
        >
          <span className="text-[18px]">📋</span>
          <span className="text-[10px] font-bold">총평</span>
        </button>
      </div>

      <main className={`w-full py-5 flex flex-col gap-4 pb-36 ${isOverall ? "px-3" : "max-w-sm mx-auto px-4"}`}>
        <div className="scene-content" key={activeTab}>

          {isOverall ? (
            <OverallTab result={result} userPhotos={userPhotos} stillImages={stillImagesRef.current} />
          ) : scene ? (
            <>
              {/* 장르 타이틀 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[15px]">{GENRE_EMOJIS[scene.genre] ?? "🎬"}</span>
                  <span className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase">{scene.genre} · SCENE {activeTab + 1}</span>
                </div>
                {genres[activeTab] && (
                  <div className="bg-[#111] border-l-[3px] border-[#C9571A] rounded-r-xl px-4 py-3">
                    <p className="text-[9px] font-bold text-[#555] uppercase tracking-widest mb-1.5">📋 지시 상황</p>
                    <p className="text-white text-[15px] font-bold leading-snug">{genres[activeTab].cue}</p>
                  </div>
                )}
              </div>

              {/* 사진 2장 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="flex flex-col gap-1.5">
                  <p className="text-[9px] font-bold text-[#444] uppercase tracking-widest text-center">내 연기</p>
                  <div className="relative rounded-xl overflow-hidden border border-white/8 aspect-square bg-[#111]">
                    {userPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userPhoto} alt="내 사진" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#333] text-[11px]">없음</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[9px] font-bold text-[#C9571A] uppercase tracking-widest text-center">AI 스틸컷</p>
                  <div className="relative rounded-xl overflow-hidden border border-[#C9571A]/20 aspect-square bg-[#111]">
                    {stillImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={stillImage} alt="스틸컷" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.015) 3px,rgba(255,255,255,0.015) 4px)", opacity: 0.6 }} />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-transparent border-t-[#C9571A]" style={{ animation: "spin 0.8s linear infinite" }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 감독의 한마디 */}
              <div className="bg-[#111] border border-white/8 rounded-2xl px-4 py-4 mb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[15px]">🎬</span>
                  <span className="text-[9px] font-bold text-[#C9571A] uppercase tracking-widest">감독의 한마디</span>
                </div>
                <p className="text-[#ccc] text-[13px] leading-[1.8] tracking-tight">{scene.critique}</p>
              </div>

              {/* 점수 */}
              {scene.scores && (
                <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl px-4 py-4 mb-3">
                  <p className="text-[9px] font-bold text-[#444] uppercase tracking-widest mb-3">연기 점수</p>
                  <div className="flex flex-col gap-2.5">
                    {SCORE_LABELS.map(label => (
                      <ScoreBar key={label} label={label} value={scene.scores[label] ?? 0} />
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-[#444]">평균</span>
                    <span className="text-[18px] font-extrabold" style={{ color: scoreColor(Math.round(SCORE_LABELS.reduce((s, l) => s + (scene.scores[l] ?? 0), 0) / 4)) }}>
                      {Math.round(SCORE_LABELS.reduce((s, l) => s + (scene.scores[l] ?? 0), 0) / 4)}
                      <span className="text-[11px] text-[#444] ml-1">/ 100</span>
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : null}

        </div>
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent pt-6 pb-6 px-4">
        <div className="max-w-sm mx-auto flex gap-2.5">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A1A1A] hover:bg-[#222] border border-white/10 text-white font-bold py-3.5 rounded-2xl text-[13px] transition-colors disabled:opacity-40"
          >
            {isSaving ? (
              <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white" style={{ animation: "spin 0.8s linear infinite" }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            전체저장
          </button>
          <button
            onClick={handleKakaoShare}
            disabled={isSharing}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#FEE500] hover:bg-[#F0D900] text-[#191919] font-bold py-3.5 rounded-2xl text-[13px] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
            </svg>
            공유
          </button>
          <Link
            href="/studio"
            className="flex-1 flex items-center justify-center bg-[#1A1A1A] hover:bg-[#222] border border-white/10 text-[#888] hover:text-white font-bold py-3.5 rounded-2xl text-[13px] transition-colors"
          >
            나가기
          </Link>
        </div>
      </div>
    </div>
  );
}
