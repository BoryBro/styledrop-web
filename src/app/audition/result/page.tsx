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
  overall_one_liner: string;
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
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] text-[#999] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
        />
      </div>
      <span className="text-[13px] font-bold w-10 text-right" style={{ color: scoreColor(value) }}>{value}점</span>
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
  stillImage,
  bestSceneIdx,
}: {
  result: AuditionResult;
  userPhotos: string[];
  stillImage: string | null;
  bestSceneIdx: number;
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

  const bestScene = result.scenes[bestSceneIdx];

  return (
    <div className="flex flex-col gap-4">
      {/* 오디션 지원서 카드 */}
      <div
        className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{
          background: "linear-gradient(135deg, #1a1410 0%, #0f0d0a 50%, #1a1410 100%)",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }} />

        <div className="relative px-5 py-6">
          {/* 헤더 */}
          <div className="mb-5">
            <p className="text-[10px] text-[#555] font-bold tracking-[0.25em] uppercase mb-1">CASTING DOCUMENT · 2026</p>
            <h2 className="text-[22px] font-extrabold text-white leading-tight">오디션 지원서</h2>
          </div>

          {/* 배정 단역 (좌) + 종합점수 (우) */}
          <div className="flex items-center bg-black/40 border border-white/8 rounded-xl px-4 py-4 mb-4 gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-[#555] uppercase tracking-widest mb-1.5">당신에게 어울리는 역할</p>
              <p className="font-black text-[#ef4444] leading-tight"
                style={{ fontSize: "clamp(16px, 5.5vw, 24px)", fontStyle: "italic",
                  textShadow: "0 0 20px rgba(239,68,68,0.4)", letterSpacing: "-0.02em" }}>
                {bestScene?.assigned_role}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-[#555] font-bold uppercase tracking-widest mb-0.5">종합점수</p>
              <p className="font-black leading-none" style={{ fontSize: "52px", color: scoreColor(avgScore), textShadow: `0 0 20px ${scoreColor(avgScore)}66` }}>
                {avgScore}
              </p>
              <p className="text-[10px] font-bold" style={{ color: avgScore >= 70 ? "#4ade80" : avgScore >= 45 ? "#f97316" : "#ef4444" }}>
                {avgScore >= 70 ? "✓ 합격권" : avgScore >= 45 ? "△ 보류" : "✗ 불합격"}
              </p>
            </div>
          </div>

          {/* 장르별 점수 바 */}
          <div className="bg-black/30 rounded-xl px-4 py-4 border border-white/8 mb-5">
            <p className="text-[11px] text-[#777] font-bold tracking-widest uppercase mb-3">장르별 점수</p>
            <div className="flex flex-col gap-3">
              {result.scenes.map((s, i) => {
                const avg = Math.round(SCORE_LABELS.reduce((sum, l) => sum + (s.scores?.[l] ?? 0), 0) / 4);
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-[14px] w-5 text-center">{GENRE_EMOJIS[s.genre] ?? "🎬"}</span>
                    <span className="text-[12px] text-[#888] w-12 shrink-0">{s.genre}</span>
                    <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${avg}%`, backgroundColor: scoreColor(avg) }} />
                    </div>
                    <span className="text-[13px] font-bold w-11 text-right" style={{ color: scoreColor(avg) }}>{avg}점</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BEST SCENE — 스틸컷 full + 촬영컷 PIP 좌측하단 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[9px] font-bold text-[#C9571A] uppercase tracking-widest">🏆 BEST SCENE</p>
              <span className="text-[9px] text-[#555]">{GENRE_EMOJIS[bestScene?.genre] ?? "🎬"} {bestScene?.genre}</span>
            </div>
            <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-[#C9571A]/30 bg-[#0f0f0f]">
              {stillImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stillImage} alt="AI 스틸컷" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#C9571A]" style={{ animation: "spin 0.8s linear infinite" }} />
                  <p className="text-[10px] text-[#444]">AI 스틸컷 생성 중...</p>
                </div>
              )}
              {/* 촬영컷 PIP */}
              {userPhotos[bestSceneIdx] && (
                <div className="absolute bottom-3 left-3 w-[80px] h-[80px] rounded-xl overflow-hidden border-2 border-white/50 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={userPhotos[bestSceneIdx]} alt="내 연기" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{
                      opacity: stamped ? 1 : 0,
                      transform: stamped ? "scale(1) rotate(-15deg)" : "scale(3) rotate(-15deg)",
                      transition: stamped ? "opacity 0.08s ease-out, transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275)" : "none",
                    }}>
                    <div className="px-1.5 py-0.5 border-[2px] border-[#dc2626] rounded"
                      style={{ color: "#dc2626", fontWeight: 900, fontSize: "10px", letterSpacing: "0.06em",
                        textShadow: "0 0 6px rgba(220,38,38,0.6)", opacity: 0.95 }}>불합격</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 감독 총평 (one-liner + 상세 총평 병합) */}
          <div className="border border-[#C9571A]/30 rounded-xl px-4 py-5 mb-5 bg-[#C9571A]/5">
            <p className="text-[11px] font-bold text-[#C9571A] uppercase tracking-widest mb-3">🎬 감독 총평</p>
            <p className="text-white font-extrabold leading-snug mb-4"
              style={{ fontSize: "clamp(17px, 5vw, 22px)" }}>
              {result.overall_one_liner}
            </p>
            <div className="border-t border-white/10 pt-4">
              <p className="text-white/80 text-[15px] leading-[1.9]">{result.overall_critique}</p>
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 flex items-center justify-between">
            <p className="text-[9px] text-[#333] font-mono">STYLEDROP CASTING DEPT.</p>
            <p className="text-[9px] text-[#333] font-mono">2026. 04.</p>
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
  const [stillImage, setStillImage] = useState<string | null>(null);
  const [bestSceneIdx, setBestSceneIdx] = useState<number>(0);
  const [genres, setGenres] = useState<GenreMeta[]>([]);
  const [phase, setPhase] = useState<Phase>("generating");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0); // 0~2 = 씬, 3 = 총평
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const stillImageRef = useRef<string | null>(null);
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

      // 베스트 씬 계산 (평균 점수 가장 높은 씬)
      const bestIdx = parsed.scenes.reduce((best, scene, i) => {
        const avg = SCORE_LABELS.reduce((s, l) => s + (scene.scores?.[l] ?? 0), 0) / 4;
        const bestAvg = SCORE_LABELS.reduce((s, l) => s + (parsed.scenes[best].scores?.[l] ?? 0), 0) / 4;
        return avg > bestAvg ? i : best;
      }, 0);
      setBestSceneIdx(bestIdx);

      fetch("/api/audition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64List[bestIdx],
          mimeType: "image/jpeg",
          stylePrompt: parsed.scenes[bestIdx].style_prompt,
        }),
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "생성 실패");
          const dataUrl = `data:image/jpeg;base64,${data.image}`;
          stillImageRef.current = dataUrl;
          setStillImage(dataUrl);
          setPhase("ready");
          // 로그인 유저 히스토리 저장 (fire and forget)
          fetch("/api/audition/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              result: parsed,
              genres: genreRaw ? JSON.parse(genreRaw) : [],
              bestSceneIdx: bestIdx,
              stillImageBase64: data.image,
            }),
          }).catch(() => {});
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
        blob = await buildSceneSaveCanvas(
          result.scenes[bestSceneIdx],
          bestSceneIdx,
          userPhotos[bestSceneIdx] ?? null,
          stillImageRef.current,
          genres[bestSceneIdx] ?? null
        );
        filename = "styledrop_audition_best.jpg";
      } else {
        const sceneIdx = activeTab;
        blob = await buildSceneSaveCanvas(
          result.scenes[sceneIdx],
          sceneIdx,
          userPhotos[sceneIdx] ?? null,
          null,
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

  const handleKakaoShare = async () => {
    if (isSharing || !result) return;
    setIsSharing(true);
    try {
      // 1) 결과를 서버에 저장해서 공개 URL 생성
      const bestPhoto = userPhotos[bestSceneIdx] ?? null;
      const res = await fetch("/api/audition/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          genres,
          bestSceneIdx,
          userPhotoBase64: bestPhoto ? bestPhoto.split(",")[1] : null,
          userPhotosBase64: userPhotos.map(p => p ? p.split(",")[1] : null),
          stillImageBase64: stillImageRef.current ? stillImageRef.current.split(",")[1] : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.id) throw new Error(json.error ?? "공유 링크 생성 실패");
      const shareUrl = window.location.origin + "/audition/share/" + json.id;

      // 2) 카카오 공유
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Kakao = (window as any).Kakao;
      if (!Kakao?.isInitialized()) {
        Kakao?.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      }
      const bestScene = result.scenes[bestSceneIdx];
      Kakao?.Share?.sendDefault({
        objectType: "text",
        text: `AI 감독이 나한테 "${bestScene?.assigned_role}" 역할을 줬어 😂\n내 오디션 결과 보러와`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
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
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-8 px-6 text-center">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes dot-bounce { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
        `}</style>
        <div className="relative w-[134px] h-[134px]">
          {userPhotos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userPhotos[0]} alt="" className="w-[134px] h-[134px] rounded-2xl object-cover border border-white/10 opacity-40" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[67px] h-[67px] rounded-full border-[5px] border-transparent border-t-[#C9571A] border-r-[#C9571A]/30" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        </div>
        <div>
          <p className="text-[#C9571A] text-[13px] font-bold tracking-[0.2em] uppercase mb-3">🎬 베스트 스틸컷 제작 중</p>
          <p className="text-white font-bold text-[22px] leading-snug">감독님이 배역을<br />결정하고 있습니다...</p>
          <div className="flex items-center justify-center gap-2 mt-5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#C9571A]" style={{ animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
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
            <OverallTab result={result} userPhotos={userPhotos} stillImage={stillImageRef.current} bestSceneIdx={bestSceneIdx} />
          ) : scene ? (
            <>
              {/* 내 연기 사진 — 최상단 */}
              <div className="mb-4 relative rounded-xl overflow-hidden border border-white/8 aspect-square bg-[#111]">
                {userPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userPhoto} alt="내 사진" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#333] text-[11px]">없음</div>
                )}
                <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <span className="text-[11px] font-bold text-[#C9571A] tracking-wide">{GENRE_EMOJIS[scene.genre] ?? "🎬"} {scene.genre} · SCENE {activeTab + 1}</span>
                </div>
              </div>

              {/* 지시 상황 */}
              {genres[activeTab] && (
                <div className="bg-[#111] border-l-[3px] border-[#C9571A] rounded-r-xl px-4 py-3 mb-4">
                  <p className="text-[9px] font-bold text-[#555] uppercase tracking-widest mb-1.5">📋 지시 상황</p>
                  <p className="text-white text-[15px] font-bold leading-snug">{genres[activeTab].cue}</p>
                </div>
              )}

              {/* 감독의 한마디 */}
              <div className="bg-[#111] border border-white/10 rounded-2xl px-4 py-5 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[16px]">🎬</span>
                  <span className="text-[11px] font-bold text-[#C9571A] uppercase tracking-widest">감독의 한마디</span>
                </div>
                <p className="text-white/90 text-[15px] leading-[1.9] tracking-tight">{scene.critique}</p>
              </div>

              {/* 점수 */}
              {scene.scores && (
                <div className="bg-[#0D0D0D] border border-white/8 rounded-2xl px-4 py-5 mb-3">
                  <p className="text-[11px] font-bold text-[#666] uppercase tracking-widest mb-4">연기 점수</p>
                  <div className="flex flex-col gap-3">
                    {SCORE_LABELS.map(label => (
                      <ScoreBar key={label} label={label} value={scene.scores[label] ?? 0} />
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between">
                    <span className="text-[12px] text-[#666]">평균</span>
                    <span className="text-[22px] font-extrabold" style={{ color: scoreColor(Math.round(SCORE_LABELS.reduce((s, l) => s + (scene.scores[l] ?? 0), 0) / 4)) }}>
                      {Math.round(SCORE_LABELS.reduce((s, l) => s + (scene.scores[l] ?? 0), 0) / 4)}
                      <span className="text-[13px] ml-0.5">점</span>
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
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#FEE500] hover:bg-[#F0D900] disabled:opacity-60 text-[#191919] font-bold py-3.5 rounded-2xl text-[13px] transition-colors"
          >
            {isSharing ? (
              <div className="w-4 h-4 rounded-full border-2 border-[#191919]/30 border-t-[#191919]" style={{ animation: "spin 0.8s linear infinite" }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
              </svg>
            )}
            {isSharing ? "링크 생성 중..." : "공유"}
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
