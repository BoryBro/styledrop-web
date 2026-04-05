"use client";

import { useEffect, useState, useRef, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { analyzePhysioPhoto, getPhysioPointMap } from "@/lib/physio-face";

// ── 타입 ──────────────────────────────────────────────────────────
type Scores = { 이해도: number; 표정연기: number; 창의성: number; 몰입도: number };

type SceneResult = {
  genre: string;
  critique: string;
  direction_fit?: string;
  emotion_read?: string;
  evidence_points?: string[];
  assigned_role: string;
  style_prompt: string;
  scores: Scores;
};

type Physiognomy = {
  analysis_status?: "ok" | "retry_required";
  face_type: string;
  archetype: string;
  archetype_reason: string;
  screen_impression?: string;
  casting_frame?: string;
  feature_readings?: string[];
  strengths: string[];
  weaknesses: string[];
  best_genre: string;
  verdict: string;
};

type AuditionResult = {
  scenes: SceneResult[];
  overall_critique: string;
  overall_one_liner: string;
  physiognomy?: Physiognomy;
  personality_summary?: string;
};

type GenreMeta = { genre: string; cue: string };
type Phase = "generating" | "ready" | "error";
type CardTheme = {
  id: "card-1" | "card-2" | "card-3" | "card-4" | "card-5";
  label: string;
  title: string;
  frameColor: string;
  titleEmoji: [string, string];
  previewSrc: string;
  accentTextColor: string;
};
type CardSticker = {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
};
type PersonalityAnswer = {
  category: string;
  question: string;
  choice: "A" | "B";
  answer: string;
};

// ── 상수 ──────────────────────────────────────────────────────────
const GENRE_EMOJIS: Record<string, string> = {
  멜로: "💔", 스릴러: "🔪", 일상: "😐", 공포: "👻", 코미디: "😂", 액션: "💥",
  판타지: "✨", 범죄: "🕵️", 로맨스: "🌹", 심리: "🧠",
};

const SCORE_LABELS = ["이해도", "표정연기", "창의성", "몰입도"] as const;
const LOCAL_PHYSIO_FALLBACK = "/images/audition/physio-face.jpg";
const CARD_THEMES: CardTheme[] = [
  {
    id: "card-1", label: "OOTD", title: "OOTD", frameColor: "#F7D319", titleEmoji: ["🌼", "🌼"], previewSrc: "/audition/cards/card-1.png",
    accentTextColor: "#F7D319",
  },
  {
    id: "card-2", label: "CRIME", title: "CRIME", frameColor: "#FF5B4D", titleEmoji: ["🔫", "🔫"], previewSrc: "/audition/cards/card-2.png",
    accentTextColor: "#FF5B4D",
  },
  {
    id: "card-3", label: "DARK HORSE", title: "DARK HORSE", frameColor: "#6D7CF6", titleEmoji: ["👻", "👻"], previewSrc: "/audition/cards/card-3.png",
    accentTextColor: "#6D7CF6",
  },
  {
    id: "card-4", label: "MAIN CHARACTER", title: "MAIN CHARACTER", frameColor: "#5BE96A", titleEmoji: ["😝", "🤓"], previewSrc: "/audition/cards/card-4.png",
    accentTextColor: "#5BE96A",
  },
  {
    id: "card-5", label: "STEALER", title: "STEALER", frameColor: "#FF4894", titleEmoji: ["🩸", "🩸"], previewSrc: "/audition/cards/card-5.png",
    accentTextColor: "#FF4894",
  },
] as const;
const CARD_STICKER_CHOICES = [
  "😎", "😂", "👀", "✨", "💥", "⚡", "👻", "🔥", "❗", "🫶",
  "😍", "😭", "😡", "🥶", "🤯", "😈", "🩸", "💋", "🖤", "💎",
  "🌼", "⭐", "🌙", "☁️", "🌈", "🎬", "🎭", "🎤", "🪄", "🔫",
  "🕶️", "💌", "🍀", "🦋", "🐈‍⬛", "👑", "💫", "‼️", "❤️‍🔥", "😝",
] as const;
const BALANCE_AXIS_MAP: Record<string, { axis: "x" | "y"; a: number; b: number }> = {
  "🎭 존재감": { axis: "x", a: 1, b: -1 },
  "💬 소통": { axis: "x", a: 2, b: -2 },
  "⚡ 행동": { axis: "x", a: 2, b: -2 },
  "🌙 감정": { axis: "x", a: 1, b: -1 },
  "👑 리더십": { axis: "y", a: 2, b: -2 },
  "🎯 목표": { axis: "y", a: 1, b: -1 },
  "🔥 야망": { axis: "y", a: 2, b: -2 },
};

// ── 관상학 실제 지식 DB ───────────────────────────────────────────
const FACE_TYPE_GUIDE: Record<string, { desc: string; acting: string; caution: string; tip: string }> = {
  "둥근형": {
    desc: "광대뼈가 낮고 턱선이 부드러운 곡선형. 얼굴에서 친근함과 포용력이 자연스럽게 풍긴다. 한국 관상학에서는 재복이 있고 대인관계가 좋다고 본다.",
    acting: "감성 연기, 순수한 주인공, 코미디, 따뜻한 조연. 공감 능력이 얼굴에서 그냥 나온다.",
    caution: "카리스마 있는 악역이나 냉철한 캐릭터에서 설득력이 약할 수 있다. 너무 착해 보여서 갈등 씬에서 밀리기 쉽다.",
    tip: "눈썹을 이용해 강약을 조절하라. 입꼬리를 내리는 연습, 눈빛에 무게를 싣는 훈련이 약점을 보완해준다.",
  },
  "각진형": {
    desc: "턱선이 뚜렷하고 얼굴 윤곽이 직선적. 의지력과 결단력이 얼굴에서 자연스럽게 나온다. 관상학에서는 강한 자아와 성취욕이 있다고 본다.",
    acting: "형사, 군인, 리더, 강인한 주인공, 카리스마 있는 악당. 화면에서 존재감이 강하게 잡힌다.",
    caution: "코미디나 순수한 멜로에서 너무 딱딱하게 보일 수 있다. 긴장을 풀지 못하면 표정 연기 폭이 좁아진다.",
    tip: "눈 주변 근육을 이완시키는 훈련이 핵심. 뺨과 입꼬리를 의식적으로 부드럽게 만드는 연습으로 감성 표현 폭을 늘려라.",
  },
  "달걀형": {
    desc: "얼굴의 황금비율. 이마부터 턱까지 자연스러운 곡선이 균형잡혀 있다. 어떤 장르에도 무리 없이 어울리는 범용성이 있다.",
    acting: "장르를 가리지 않는 올라운더. 주인공부터 악역까지 어느 쪽이든 가능하다.",
    caution: "너무 평범해 보여서 기억에 남기 어려울 수 있다. 강한 첫인상이 없어서 캐릭터를 스스로 만들어야 한다.",
    tip: "목소리 톤, 걸음걸이, 제스처 등 얼굴 외 요소로 강한 개성을 만들어라. 얼굴이 캐릭터를 대신해주지 않으니 연기력으로 채워야 한다.",
  },
  "역삼각형": {
    desc: "넓은 이마에 좁은 턱으로 뾰족하게 내려오는 형태. 날카롭고 분석적인 인상이다. 관상학에서는 지성과 판단력이 뛰어나다고 본다.",
    acting: "냉철한 악역, 천재 캐릭터, 형사, 스파이, 분석가. 설명 없이도 '뭔가 있어 보이는' 얼굴이다.",
    caution: "너무 차갑게 보여서 대중적인 주인공 역할에서 거리감이 생길 수 있다. 첫인상이 강하다 보니 캐릭터 반전이 어렵다.",
    tip: "웃는 연습과 눈꼬리를 아래로 향하게 하는 표정 훈련으로 따뜻한 면을 보여줘라. 강점은 이미 있으니 약점인 부드러움을 키워라.",
  },
};

const ARCHETYPE_GUIDE: Record<string, { summary: string; strength: string; blind_spot: string; advice: string }> = {
  "카리스마 주인공형": {
    summary: "화면에 등장하는 순간 시선이 집중되는 얼굴 구조. 넓은 이마, 강한 눈빛, 뚜렷한 코의 조합이다.",
    strength: "리더십이 얼굴에서 그냥 나온다. 억지로 포스를 만들 필요가 없다.",
    blind_spot: "자칫 이미지가 획일적이 될 수 있다. 캐릭터마다 다른 면을 보여주지 않으면 매너리즘 위험.",
    advice: "이미 있는 카리스마보다 내면의 취약점을 표현하는 연습에 집중해라. 그게 주인공을 입체적으로 만든다.",
  },
  "냉철한 악역형": {
    summary: "날카로운 눈빛, 높은 광대, 각진 턱. 자연스럽게 긴장감을 주는 얼굴이다.",
    strength: "악역 연기에서 별도의 노력 없이 분위기가 살아난다. 존재 자체가 위협적이다.",
    blind_spot: "악역이 너무 자연스러워서 평범한 역할에서 오히려 어색할 수 있다. 착한 역할 시 어색함 주의.",
    advice: "눈빛의 온도를 조절하는 연습이 핵심. 차가움과 따뜻함 사이를 자유자재로 오가는 눈빛 훈련을 해라.",
  },
  "순수 서브주인공형": {
    summary: "크고 맑은 눈, 온화한 전체 인상, 둥근 턱. 공감 능력이 얼굴에서 그대로 느껴진다.",
    strength: "감정 이입이 자연스럽고 관객이 보호본능을 느낀다. 주인공 곁에서 빛나는 타입.",
    blind_spot: "주연을 맡았을 때 존재감이 약해질 수 있다. 강한 의지를 표현하기가 상대적으로 어렵다.",
    advice: "조연에서 최대 임팩트를 내는 전략이 맞다. 대신 특정 장면에서 감정을 폭발시키는 연기 훈련으로 기억에 남아라.",
  },
  "반전 매력형": {
    summary: "선해 보이는데 날카로운 부분이 공존하는 얼굴. 보는 사람에 따라 다르게 읽힌다.",
    strength: "캐릭터에 반전을 넣으면 임팩트가 배가 된다. 예상을 벗어나는 연기가 자연스럽게 설득력을 가진다.",
    blind_spot: "첫인상이 일정하지 않아서 캐릭터가 흔들려 보일 수 있다. 감독 입장에서 어디에 쓸지 헷갈릴 수 있음.",
    advice: "첫 씬에서 캐릭터 인상을 강하게 각인해라. 반전은 그 다음에 나와야 효과가 있다. 순서가 중요하다.",
  },
  "멜로 감성형": {
    summary: "눈꼬리가 내려가고 눈빛이 감성적이며 전체적으로 부드러운 선. 감정 표현이 얼굴 구조에서 나온다.",
    strength: "멜로 연기에서 억지로 슬퍼 보일 필요가 없다. 얼굴이 이미 감정을 전달하고 있다.",
    blind_spot: "강한 대립 씬이나 액션에서 힘이 밀릴 수 있다. 지나치게 감성적으로만 보여 캐릭터 폭이 좁아질 위험.",
    advice: "눈썹 각도를 올리는 연습으로 강인함을 표현하는 법을 익혀라. 감성이 무기이지만 강인함도 보여줄 수 있어야 한다.",
  },
  "독립영화 감성형": {
    summary: "독특하고 개성 있는 얼굴 조합. 틀에 박히지 않은 인상이다.",
    strength: "개성 있는 캐릭터를 표현할 때 아무도 흉내 낼 수 없는 자기만의 색이 나온다.",
    blind_spot: "대중적인 상업 영화에서는 오히려 튈 수 있다. 감독에 따라 호불호가 갈린다.",
    advice: "자기만의 강점을 극대화하는 쪽으로 가라. 평범해지려 하지 말고 독특함을 더 선명하게 만들어라.",
  },
  "인생 조연형": {
    summary: "균형잡혀 있지만 주인공 아우라가 없는 얼굴. 어디에도 무리 없이 어울리는 타입.",
    strength: "어떤 작품에도 자연스럽게 녹아든다. 캐릭터를 방해하지 않는 안정적인 존재감.",
    blind_spot: "기억에 남기 어렵다. 균형이 오히려 임팩트를 줄인다.",
    advice: "특별한 quirk(습관, 버릇, 말투)를 캐릭터에 심어라. 얼굴이 기억해주지 않으니 행동으로 기억에 남아야 한다.",
  },
  "카리스마 조연형": {
    summary: "강한 인상이지만 주인공 아우라보다는 조연 느낌이 강한 얼굴.",
    strength: "주인공보다 더 기억에 남을 수 있는 얼굴. 씬 도둑질에 특화돼 있다.",
    blind_spot: "주연을 맡으면 부담스럽게 보일 수 있다. 조연에서 더 자연스럽다는 걸 받아들여야 한다.",
    advice: "조연임에도 불구하고 모든 등장 씬에서 최대 임팩트를 내는 전략을 써라. 세컨드 리드가 주인공을 압도하는 게 이 얼굴의 최고 시나리오다.",
  },
};

// ── 유틸 함수 ─────────────────────────────────────────────────────
function scoreColor(v: number) {
  if (v >= 70) return "#22c55e";
  if (v >= 45) return "#f97316";
  return "#ef4444";
}

function avgScore(scores: Scores) {
  return Math.round(SCORE_LABELS.reduce((s, l) => s + (scores[l] ?? 0), 0) / 4);
}

function gradeLabel(score: number) {
  if (score >= 80) return { label: "합격", color: "#22c55e" };
  if (score >= 60) return { label: "보류", color: "#f97316" };
  return { label: "불합격", color: "#ef4444" };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function analyzeBalanceAxes(answers: PersonalityAnswer[]) {
  let xRaw = 0;
  let xMax = 0;
  let yRaw = 0;
  let yMax = 0;

  for (const answer of answers) {
    const axis = BALANCE_AXIS_MAP[answer.category];
    if (!axis) continue;
    const delta = answer.choice === "A" ? axis.a : axis.b;
    if (axis.axis === "x") {
      xRaw += delta;
      xMax += Math.max(Math.abs(axis.a), Math.abs(axis.b));
    } else {
      yRaw += delta;
      yMax += Math.max(Math.abs(axis.a), Math.abs(axis.b));
    }
  }

  const xScore = xMax > 0 ? Math.round(50 + (xRaw / xMax) * 50) : 50;
  const yScore = yMax > 0 ? Math.round(50 + (yRaw / yMax) * 50) : 50;
  const xLeanPositive = xScore >= 50;
  const yLeanPositive = yScore >= 50;
  const xEvidence = answers.filter(answer => {
    const axis = BALANCE_AXIS_MAP[answer.category];
    if (!axis || axis.axis !== "x") return false;
    const delta = answer.choice === "A" ? axis.a : axis.b;
    return xLeanPositive ? delta > 0 : delta < 0;
  }).slice(0, 2);
  const yEvidence = answers.filter(answer => {
    const axis = BALANCE_AXIS_MAP[answer.category];
    if (!axis || axis.axis !== "y") return false;
    const delta = answer.choice === "A" ? axis.a : axis.b;
    return yLeanPositive ? delta > 0 : delta < 0;
  }).slice(0, 2);

  return {
    xScore,
    yScore,
    xLabel: xLeanPositive ? "직진형" : "신중형",
    yLabel: yLeanPositive ? "주도형" : "안정형",
    xEvidence,
    yEvidence,
  };
}

function genreCardTitle(genre: string) {
  const key = genre.trim().toLowerCase();
  const map: Record<string, string> = {
    "판타지": "FANTASY",
    "범죄": "CRIME",
    "스릴러": "THRILLER",
    "멜로": "MELO",
    "로맨스": "ROMANCE",
    "로코": "ROM-COM",
    "코미디": "COMEDY",
    "공포": "HORROR",
    "액션": "ACTION",
    "심리": "PSYCHO",
    "드라마": "DRAMA",
    "fantasy": "FANTASY",
    "crime": "CRIME",
    "thriller": "THRILLER",
    "melo": "MELO",
    "romance": "ROMANCE",
    "rom-com": "ROM-COM",
    "comedy": "COMEDY",
    "horror": "HORROR",
    "action": "ACTION",
    "psychological": "PSYCHO",
    "drama": "DRAMA",
  };
  return map[key] ?? genre.toUpperCase().slice(0, 18);
}

// ── ScoreBar ──────────────────────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] text-gray-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: scoreColor(value) }} />
      </div>
      <span className="text-[13px] font-bold w-10 text-right tabular-nums" style={{ color: scoreColor(value) }}>{value}</span>
    </div>
  );
}

function PhysioScanVisual({ src }: { src: string }) {
  const [physioOverlay, setPhysioOverlay] = useState<Awaited<ReturnType<typeof analyzePhysioPhoto>> | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;
    analyzePhysioPhoto(src)
      .then((nextOverlay) => {
        if (cancelled) return;
        setPhysioOverlay(nextOverlay);
      })
      .catch(() => {
        if (cancelled) return;
        setPhysioOverlay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const geometry = physioOverlay?.geometry;
  const pointMap = geometry ? getPhysioPointMap(geometry) : null;
  const labelFontSize = geometry ? Math.max(geometry.imageWidth, geometry.imageHeight) * 0.018 : 16;
  const clipPath = `url(#${clipId})`;

  if (!geometry || !pointMap) {
    return (
      <div className="rounded-[28px] overflow-hidden bg-[#111] border border-black/10 flex items-center justify-center py-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(201,87,26,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.12)_100%)]" />
        <div className="relative z-[1] h-[270px] w-[220px] overflow-hidden rounded-[32px] border border-white/10 bg-[#151515] shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="관상 사진" className="h-full w-full object-cover brightness-[0.84]" />
        </div>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <span className="text-[10px] font-black text-[#C9571A] tracking-[0.3em] uppercase opacity-75">AI SCANNING</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] overflow-hidden bg-[#111] border border-black/10 flex items-center justify-center py-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(201,87,26,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0.12)_100%)]" />
      <div className="relative z-[1] w-[220px] aspect-[4/5]">
        <svg viewBox={`0 0 ${geometry.imageWidth} ${geometry.imageHeight}`} xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#151515] shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
          <defs>
            <clipPath id={clipId}>
              <rect width={geometry.imageWidth} height={geometry.imageHeight} rx={geometry.imageWidth * 0.1} ry={geometry.imageWidth * 0.1} />
            </clipPath>
            <linearGradient id={gradientId} x1="0" y1="0" x2={geometry.imageWidth} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="white" stopOpacity="0.95" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <g clipPath={clipPath}>
            <image href={src} x="0" y="0" width={geometry.imageWidth} height={geometry.imageHeight} preserveAspectRatio="xMidYMid slice" opacity="0.92" />
            <rect width={geometry.imageWidth} height={geometry.imageHeight} fill="url(#physioVignette)" opacity="0.35" />
            <defs>
              <radialGradient id="physioVignette" cx="50%" cy="34%" r="62%">
                <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                <stop offset="55%" stopColor="transparent" stopOpacity="0" />
                <stop offset="100%" stopColor="black" stopOpacity="0.6" />
              </radialGradient>
            </defs>
          </g>
          <rect
            x={geometry.faceBox.x}
            y={geometry.faceBox.y + geometry.faceBox.height * 0.04}
            width={geometry.faceBox.width}
            height={geometry.faceBox.height * 0.92}
            rx={geometry.faceBox.width * 0.48}
            ry={geometry.faceBox.width * 0.48}
            stroke="#C9571A"
            strokeWidth={Math.max(geometry.imageWidth, geometry.imageHeight) * 0.005}
            strokeOpacity="0.42"
            strokeDasharray={`${Math.max(geometry.imageWidth, geometry.imageHeight) * 0.02} ${Math.max(geometry.imageWidth, geometry.imageHeight) * 0.014}`}
            fill="none"
          />
          <ellipse
            cx={geometry.faceBox.x + geometry.faceBox.width / 2}
            cy={geometry.faceBox.y + geometry.faceBox.height * 0.52}
            rx={geometry.faceBox.width * 0.39}
            ry={geometry.faceBox.height * 0.39}
            stroke="white"
            strokeWidth={Math.max(geometry.imageWidth, geometry.imageHeight) * 0.0028}
            strokeOpacity="0.14"
            fill="none"
          />
          <line x1={pointMap.forehead.x} y1={pointMap.forehead.y} x2={pointMap.leftEye.x} y2={pointMap.leftEye.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.0032} strokeOpacity="0.38" />
          <line x1={pointMap.forehead.x} y1={pointMap.forehead.y} x2={pointMap.rightEye.x} y2={pointMap.rightEye.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.0032} strokeOpacity="0.38" />
          <line x1={pointMap.leftEye.x} y1={pointMap.leftEye.y} x2={pointMap.rightEye.x} y2={pointMap.rightEye.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.0026} strokeOpacity="0.28" />
          <line x1={pointMap.leftEye.x} y1={pointMap.leftEye.y} x2={pointMap.nose.x} y2={pointMap.nose.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.003} strokeOpacity="0.38" />
          <line x1={pointMap.rightEye.x} y1={pointMap.rightEye.y} x2={pointMap.nose.x} y2={pointMap.nose.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.003} strokeOpacity="0.38" />
          <line x1={pointMap.nose.x} y1={pointMap.nose.y} x2={pointMap.mouth.x} y2={pointMap.mouth.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.003} strokeOpacity="0.3" />
          <line x1={pointMap.mouth.x} y1={pointMap.mouth.y} x2={pointMap.chin.x} y2={pointMap.chin.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.0028} strokeOpacity="0.25" />
          <line x1={pointMap.leftCheek.x} y1={pointMap.leftCheek.y} x2={pointMap.leftEye.x} y2={pointMap.leftEye.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.0028} strokeOpacity="0.22" />
          <line x1={pointMap.rightCheek.x} y1={pointMap.rightCheek.y} x2={pointMap.rightEye.x} y2={pointMap.rightEye.y} stroke="#C9571A" strokeWidth={geometry.imageWidth * 0.0028} strokeOpacity="0.22" />
          {geometry.points.map((point, index) => (
            <g key={point.key}>
              <circle
                cx={point.x}
                cy={point.y}
                r={point.key === "forehead" ? geometry.imageWidth * 0.022 : geometry.imageWidth * 0.018}
                fill="white"
                fillOpacity="0.96"
                stroke="#C9571A"
                strokeWidth={geometry.imageWidth * 0.0065}
                style={{ animation: "dot-pulse 2.2s ease-in-out infinite", animationDelay: `${index * 0.18}s` }}
              />
              <text
                x={point.x + geometry.imageWidth * 0.036}
                y={point.y - geometry.imageHeight * 0.01}
                fontSize={labelFontSize}
                fill="white"
                fillOpacity="0.86"
                fontFamily="Pretendard, sans-serif"
                fontWeight="700"
              >
                {point.label}
              </text>
            </g>
          ))}
          <rect
            x={geometry.faceBox.x}
            y={geometry.imageHeight * 0.06}
            width={geometry.faceBox.width}
            height={geometry.imageHeight * 0.008}
            rx={geometry.imageHeight * 0.004}
            fill={`url(#${gradientId})`}
            style={{ animation: "scan-line 3s ease-in-out infinite" }}
          />
        </svg>
      </div>
      {physioOverlay?.status === "unsupported" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5">
          <span className="text-[10px] font-black text-white/70 tracking-[0.14em] uppercase">Auto Detect Limited</span>
        </div>
      )}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <span className="text-[10px] font-black text-[#C9571A] tracking-[0.3em] uppercase opacity-75">AI SCANNING</span>
      </div>
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

function parseStoredValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function dataUrlPayload(src: string) {
  return src.startsWith("data:") ? src.split(",")[1] ?? null : null;
}

async function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지 인코딩 실패"));
        return;
      }
      const payload = reader.result.split(",")[1];
      if (!payload) {
        reject(new Error("이미지 인코딩 실패"));
        return;
      }
      resolve(payload);
    };
    reader.onerror = () => reject(reader.error ?? new Error("이미지 인코딩 실패"));
    reader.readAsDataURL(blob);
  });
}

async function srcToBase64Payload(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  const inlinePayload = dataUrlPayload(src);
  if (inlinePayload) return inlinePayload;

  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToBase64Payload(blob);
  } catch {
    return null;
  }
}

async function buildSaveCanvas(
  result: AuditionResult,
  bestScene: SceneResult,
  bestSceneIdx: number,
  userPhoto: string | null,
  stillImage: string | null,
  genreMeta: GenreMeta | null
): Promise<Blob> {
  const W = 640;
  const PAD = 24;
  const PHOTO_SIZE = (W - PAD * 3) / 2;
  const HEADER_H = 80;
  const PHOTOS_H = PHOTO_SIZE + 20;
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

  const emoji = GENRE_EMOJIS[bestScene.genre] ?? "🎬";
  ctx.fillStyle = "#C9571A";
  ctx.font = "bold 16px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${emoji} ${bestScene.genre} · SCENE ${bestSceneIdx + 1}`, W / 2, 38);

  ctx.fillStyle = "#666";
  ctx.font = "12px -apple-system, sans-serif";
  const cueText = genreMeta ? `"${genreMeta.cue}"` : "";
  if (cueText.length > 50) ctx.fillText(cueText.slice(0, 50) + "...", W / 2, 60);
  else ctx.fillText(cueText, W / 2, 60);

  const PHOTO_Y = HEADER_H;
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.fillStyle = "#444";
  ctx.textAlign = "center";
  ctx.fillText("내 연기", PAD + PHOTO_SIZE / 2, PHOTO_Y);
  ctx.fillStyle = "#C9571A";
  ctx.fillText("AI 스틸컷", PAD * 2 + PHOTO_SIZE + PHOTO_SIZE / 2, PHOTO_Y);

  const IMG_Y = PHOTO_Y + 14;
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

  const ROLE_Y = HEADER_H + PHOTOS_H;
  ctx.font = "bold 28px -apple-system, sans-serif";
  ctx.fillStyle = "#C9571A";
  ctx.textAlign = "center";
  ctx.fillText(bestScene.assigned_role, W / 2, ROLE_Y + 40);

  const CRIT_Y = ROLE_Y + ROLE_H;
  ctx.font = "14px -apple-system, sans-serif";
  ctx.fillStyle = "#aaa";
  ctx.textAlign = "left";
  wrapText(ctx, bestScene.critique, PAD, CRIT_Y + 20, W - PAD * 2, 22);

  const SCORE_Y = CRIT_Y + CRITIQUE_H;
  ctx.fillStyle = "#555";
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SCORE", PAD, SCORE_Y + 16);

  SCORE_LABELS.forEach((label, i) => {
    const val = bestScene.scores[label] ?? 0;
    const BY = SCORE_Y + 30 + i * 22;
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillStyle = "#666";
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, BY);
    ctx.fillStyle = "#333";
    ctx.fillRect(PAD + 56, BY - 9, W - PAD * 2 - 100, 8);
    ctx.fillStyle = val >= 70 ? "#4ade80" : val >= 45 ? "#f97316" : "#ef4444";
    ctx.fillRect(PAD + 56, BY - 9, (W - PAD * 2 - 100) * val / 100, 8);
    ctx.fillStyle = "#aaa";
    ctx.textAlign = "right";
    ctx.fillText(String(val), W - PAD, BY);
  });

  ctx.fillStyle = "#222";
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.font = "bold 12px -apple-system, sans-serif";
  ctx.fillStyle = "#C9571A";
  ctx.textAlign = "center";
  ctx.fillText("StyleDrop AI Audition", W / 2, H - FOOTER_H + 22);
  ctx.font = "11px -apple-system, sans-serif";
  ctx.fillStyle = "#555";
  ctx.fillText(result.overall_one_liner.slice(0, 60), W / 2, H - FOOTER_H + 40);

  return new Promise(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.92));
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function AuditionResult() {
  const [result, setResult] = useState<AuditionResult | null>(null);
  const [userPhotos, setUserPhotos] = useState<string[]>([]);
  const [stillImage, setStillImage] = useState<string | null>(null);
  const [bestSceneIdx, setBestSceneIdx] = useState<number>(0);
  const [genres, setGenres] = useState<GenreMeta[]>([]);
  const [phase, setPhase] = useState<Phase>("generating");
  const [activeSceneTab, setActiveSceneTab] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [isGeneratingStill, setIsGeneratingStill] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [shareRewardToast, setShareRewardToast] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [physioPhoto, setPhysioPhoto] = useState<string | null>(null);
  const [personalityAnswers, setPersonalityAnswers] = useState<PersonalityAnswer[]>([]);
  const [activePhysioTab, setActivePhysioTab] = useState(0);
  const [selectedCardThemeId, setSelectedCardThemeId] = useState<CardTheme["id"]>("card-1");
  const [cardStickers, setCardStickers] = useState<CardSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [historyShareId, setHistoryShareId] = useState<string | null | undefined>(undefined);
  const cachedShareId = useRef<string | null>(null);
  const stillImageRef = useRef<string | null>(null);
  const cardStageRef = useRef<HTMLDivElement | null>(null);
  const draggingStickerIdRef = useRef<string | null>(null);
  const activeStickerPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ stickerId: string | null; startDistance: number; startSize: number }>({
    stickerId: null,
    startDistance: 0,
    startSize: 44,
  });
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHistoryShareId(params.get("history_share"));
  }, []);

  // 분석 결과 로드 (무료 — 스틸컷 자동 생성 안 함)
  useEffect(() => {
    let cancelled = false;

    if (historyShareId === undefined) {
      return () => {
        cancelled = true;
      };
    }

    const loadHistoryResult = async (shareId: string) => {
      try {
        const response = await fetch(`/api/audition/share?id=${encodeURIComponent(shareId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "기록 로드 실패");

        const parsedResult = parseStoredValue<AuditionResult | null>(data.result_json, null);
        if (!parsedResult || !Array.isArray(parsedResult.scenes) || parsedResult.scenes.length === 0) {
          throw new Error("결과 데이터가 비어 있습니다.");
        }

        const parsedGenres = parseStoredValue<GenreMeta[]>(data.genres_json, []);
        const rawBestSceneIdx = Number(data.best_scene_idx ?? 0);
        const nextBestSceneIdx = clamp(
          Number.isFinite(rawBestSceneIdx) ? rawBestSceneIdx : 0,
          0,
          parsedResult.scenes.length - 1
        );

        const storedUserPhotos = parseStoredValue<unknown[]>(data.user_photos_json, []);
        let nextUserPhotos = (Array.isArray(storedUserPhotos) ? storedUserPhotos : []).map((photo) => (
          typeof photo === "string" ? photo : ""
        ));
        if (
          nextUserPhotos.every((photo) => !photo) &&
          typeof data.user_photo_url === "string" &&
          data.user_photo_url
        ) {
          nextUserPhotos = Array.from({ length: parsedResult.scenes.length }, (_, index) => (
            index === nextBestSceneIdx ? data.user_photo_url : ""
          ));
        }

        const nextStillImage = typeof data.still_image_url === "string" && data.still_image_url
          ? data.still_image_url
          : null;

        if (cancelled) return;
        cachedShareId.current = shareId;
        stillImageRef.current = nextStillImage;
        setResult(parsedResult);
        setGenres(parsedGenres);
        setUserPhotos(nextUserPhotos);
        setStillImage(nextStillImage);
        setBestSceneIdx(nextBestSceneIdx);
        setPhysioPhoto(null);
        setErrorMsg(null);
        setPhase("ready");
        return;
      } catch {
        if (cancelled) return;
        setErrorMsg("결과 기록을 불러오지 못했어요.");
        setPhase("error");
      }
    };

    if (historyShareId) {
      void loadHistoryResult(historyShareId);
      return () => {
        cancelled = true;
      };
    }

    const raw = sessionStorage.getItem("sd_au_result");
    const imagesRaw = sessionStorage.getItem("sd_au_images");
    const genreRaw = sessionStorage.getItem("sd_au_genres");
    const physioRaw = sessionStorage.getItem("sd_au_physio");
    const personalityRaw = sessionStorage.getItem("sd_au_personality");

    if (!raw) {
      router.replace("/audition/solo");
      return () => {
        cancelled = true;
      };
    }

    try {
      const parsed: AuditionResult = JSON.parse(raw);
      cachedShareId.current = null;
      stillImageRef.current = null;
      setStillImage(null);
      setResult(parsed);
      if (genreRaw) setGenres(JSON.parse(genreRaw));
      else setGenres([]);
      if (physioRaw) setPhysioPhoto(physioRaw);
      else setPhysioPhoto(LOCAL_PHYSIO_FALLBACK);
      if (personalityRaw) setPersonalityAnswers(JSON.parse(personalityRaw));
      else setPersonalityAnswers([]);

      const photos: string[] = imagesRaw ? JSON.parse(imagesRaw) : [];
      setUserPhotos(photos);

      const bestIdx = parsed.scenes.reduce((best, scene, i) => {
        const a = SCORE_LABELS.reduce((s, l) => s + (scene.scores?.[l] ?? 0), 0) / 4;
        const b = SCORE_LABELS.reduce((s, l) => s + (parsed.scenes[best].scores?.[l] ?? 0), 0) / 4;
        return a > b ? i : best;
      }, 0);
      setBestSceneIdx(bestIdx);
      setErrorMsg(null);
      setPhase("ready");
    } catch {
      router.replace("/audition/solo");
    }

    return () => {
      cancelled = true;
    };
  }, [historyShareId, router]);

  // 크레딧 + 유저 ID 조회
  useEffect(() => {
    fetch("/api/credits").then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => setCredits(0));
    fetch("/api/auth/me").then(r => r.json()).then(d => setUserId(d.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!cardStageRef.current) return;
      const rect = cardStageRef.current.getBoundingClientRect();
      if (activeStickerPointersRef.current.has(event.pointerId)) {
        activeStickerPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      const activePointers = [...activeStickerPointersRef.current.values()];
      if (activePointers.length >= 2 && pinchStateRef.current.stickerId) {
        const [a, b] = activePointers;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const nextSize = clamp(
          Math.round((pinchStateRef.current.startSize * distance) / Math.max(pinchStateRef.current.startDistance, 1)),
          24,
          160
        );
        setCardStickers(prev => prev.map(sticker => (
          sticker.id === pinchStateRef.current.stickerId
            ? { ...sticker, size: nextSize }
            : sticker
        )));
        return;
      }

      if (!draggingStickerIdRef.current) return;
      const x = clamp((event.clientX - rect.left) / rect.width, 0.12, 0.88);
      const y = clamp((event.clientY - rect.top) / rect.height, 0.12, 0.76);
      setCardStickers(prev => prev.map(sticker => (
        sticker.id === draggingStickerIdRef.current
          ? { ...sticker, x, y }
          : sticker
      )));
    };

    const handlePointerUp = (event: PointerEvent) => {
      activeStickerPointersRef.current.delete(event.pointerId);
      if (activeStickerPointersRef.current.size < 2) {
        pinchStateRef.current = {
          stickerId: null,
          startDistance: 0,
          startSize: 44,
        };
      }
      if (activeStickerPointersRef.current.size === 0) {
        draggingStickerIdRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const addCardSticker = useCallback((emoji: string) => {
    const nextId = `${emoji}-${Date.now()}`;
    setSelectedStickerId(nextId);
    setCardStickers(prev => [
      ...prev,
      {
        id: nextId,
        emoji,
        x: 0.5,
        y: 0.34,
        size: 44,
        rotate: (prev.length % 2 === 0 ? -1 : 1) * 10,
      },
    ]);
  }, []);

  const removeLastCardSticker = useCallback(() => {
    setCardStickers(prev => {
      const next = prev.slice(0, -1);
      if (!next.find(sticker => sticker.id === selectedStickerId)) {
        setSelectedStickerId(next.at(-1)?.id ?? null);
      }
      return next;
    });
  }, [selectedStickerId]);

  const resetCardStickers = useCallback(() => {
    setCardStickers([]);
    setSelectedStickerId(null);
  }, []);

  const buildShareRequestPayload = useCallback(async () => {
    if (!result) throw new Error("결과가 없습니다.");
    const bestPhoto = userPhotos[bestSceneIdx] ?? null;
    const [userPhotoBase64, stillImageBase64, userPhotosBase64] = await Promise.all([
      srcToBase64Payload(bestPhoto),
      srcToBase64Payload(stillImageRef.current),
      Promise.all(userPhotos.map((photo) => srcToBase64Payload(photo))),
    ]);

    return {
      result,
      genres,
      bestSceneIdx,
      userPhotoBase64,
      userPhotosBase64,
      stillImageBase64,
    };
  }, [bestSceneIdx, genres, result, userPhotos]);

  const ensureShareId = useCallback(async () => {
    if (cachedShareId.current) return cachedShareId.current;
    const payload = await buildShareRequestPayload();
    const response = await fetch("/api/audition/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.id) {
      throw new Error(data.error ?? "공유 링크 생성 실패");
    }
    cachedShareId.current = data.id;
    return data.id as string;
  }, [buildShareRequestPayload]);

  // 스틸컷 생성 (5크레딧 소모)
  const handleGenerateStill = async () => {
    if (isGeneratingStill || !result) return;
    const photos: string[] = sessionStorage.getItem("sd_au_images")
      ? JSON.parse(sessionStorage.getItem("sd_au_images")!)
      : userPhotos;
    const photoPayloads = await Promise.all(photos.map((photo) => srcToBase64Payload(photo)));
    const base64List = photoPayloads.filter((payload): payload is string => Boolean(payload));
    if (base64List.length === 0) return;
    setIsGeneratingStill(true);
    try {
      const genreRaw = sessionStorage.getItem("sd_au_genres");
      const res = await fetch("/api/audition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64List[bestSceneIdx] ?? base64List[0],
          mimeType: "image/jpeg",
          stylePrompt: result.scenes[bestSceneIdx].style_prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      const dataUrl = `data:image/jpeg;base64,${data.image}`;
      stillImageRef.current = dataUrl;
      setStillImage(dataUrl);
      setCredits(c => (c !== null ? Math.max(0, c - 3) : 0));
      fetch("/api/audition/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          genres: genreRaw ? JSON.parse(genreRaw) : genres,
          bestSceneIdx,
          stillImageBase64: data.image,
          userPhotoBase64: photoPayloads[bestSceneIdx] ?? base64List[0] ?? null,
          userPhotosBase64: photoPayloads,
        }),
      }).catch(() => {});
    } catch (err) {
      alert((err instanceof Error ? err.message : "") || "스틸컷 생성에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsGeneratingStill(false);
    }
  };

  // 공유 후 1크레딧 보상
  const claimShareReward = () => {
    fetch("/api/reward/share", { method: "POST" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setCredits(d.credits);
          setShareRewardToast(true);
          setTimeout(() => setShareRewardToast(false), 3000);
        }
      })
      .catch(() => {});
  };

  const handleSave = useCallback(async () => {
    if (!result || isSaving) return;
    setIsSaving(true);
    try {
      const blob = await buildSaveCanvas(
        result,
        result.scenes[bestSceneIdx],
        bestSceneIdx,
        userPhotos[bestSceneIdx] ?? null,
        stillImageRef.current,
        genres[bestSceneIdx] ?? null
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "styledrop_audition.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  }, [result, isSaving, userPhotos, genres, bestSceneIdx]);

  const handleKakaoShare = async () => {
    if (isSharing || !result) return;
    setIsSharing(true);
    try {
      const shareId = await ensureShareId();
      const shareUrl = window.location.origin + "/audition/share/" + shareId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Kakao = (window as any).Kakao;
      if (!Kakao?.isInitialized()) Kakao?.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      const bestScene = result.scenes[bestSceneIdx];
      Kakao?.Share?.sendDefault({
        objectType: "text",
        text: `AI 감독이 나한테 "${bestScene?.assigned_role}" 역할을 줬어 😂\n내 오디션 결과 보러와`,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      });
      fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_type: "audition_share_kakao" }) }).catch(() => {});
      claimShareReward();
    } catch {
      navigator.clipboard?.writeText(window.location.origin + "/audition/solo");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (isCopying || !result) return;
    setIsCopying(true);
    try {
      const id = await ensureShareId();
      await navigator.clipboard.writeText(window.location.origin + "/audition/share/" + id);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
      fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_type: "audition_share_link_copy" }) }).catch(() => {});
      claimShareReward();
    } catch { /* silent */ }
    finally { setIsCopying(false); }
  };

  if (!result) return null;

  // ── ERROR ─────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-[40px]">😵</p>
        <p className="text-gray-900 font-bold text-[18px]">오디션이 중단됐습니다</p>
        <p className="text-gray-500 text-[14px]">{errorMsg}</p>
        <Link href="/studio" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">밖으로 나가기</Link>
      </div>
    );
  }

  // ── READY — 단일 스크롤 ──────────────────────────────────────────
  const physio = result.physiognomy;
  const bestScene = result.scenes[bestSceneIdx];
  const overallAvg = Math.round(result.scenes.reduce((s, sc) => s + avgScore(sc.scores), 0) / result.scenes.length);
  const grade = gradeLabel(overallAvg);
  const physioNeedsRetry = Boolean(
    physio && (
      physio.analysis_status === "retry_required" ||
      physio.face_type === "판별불가" ||
      physio.archetype === "판별불가"
    )
  );
  const faceGuide = physio && !physioNeedsRetry ? FACE_TYPE_GUIDE[physio.face_type] : null;
  const archetypeGuide = physio && !physioNeedsRetry ? ARCHETYPE_GUIDE[physio.archetype] : null;
  const selectedCardTheme = CARD_THEMES.find(theme => theme.id === selectedCardThemeId) ?? CARD_THEMES[0];
  const cardPreviewImage = userPhotos[bestSceneIdx] ?? stillImage ?? physioPhoto ?? null;
  const cardTitle = genreCardTitle(bestScene.genre);
  const actingScore = avgScore(bestScene.scores);
  const emotionalRangeScore = bestScene.scores["표정연기"] ?? 0;
  const screenPresenceScore = bestScene.scores["몰입도"] ?? 0;
  const cardCueLine = (genres[bestSceneIdx]?.cue ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
  const weakestSceneIdx = result.scenes.reduce((worst, scene, i) => (
    avgScore(scene.scores) < avgScore(result.scenes[worst].scores) ? i : worst
  ), 0);
  const weakestScene = result.scenes[weakestSceneIdx];
  const balanceAxes = analyzeBalanceAxes(personalityAnswers);
  const bestToneLabel =
    balanceAxes.xScore >= 60 && balanceAxes.yScore >= 60 ? "밀어붙이는 주도형 배역" :
    balanceAxes.xScore >= 60 ? "감정 직진형 배역" :
    balanceAxes.yScore >= 60 ? "계산된 존재감 배역" :
    "짧고 센 단역 배역";
  const balanceFunSummary =
    balanceAxes.xScore >= 60 && balanceAxes.yScore >= 60
      ? "답변 패턴상 숨기기보다 밀어붙이는 쪽에 가까워서, 존재감 있는 배역에 잘 붙습니다."
      : balanceAxes.xScore >= 60
        ? "답변 패턴상 감정을 안으로 숨기기보다 밖으로 드러내는 쪽이 더 자연스럽게 읽혔습니다."
        : balanceAxes.yScore >= 60
          ? "답변 패턴상 분위기를 끌고 가는 성향은 있는데, 감정 표현은 조금 더 아껴 쓰는 타입에 가깝습니다."
          : "답변 패턴상 무작정 튀기보다 간을 보고 움직이는 편이라, 세게 밀어붙이는 배역보다는 계산된 톤이 더 잘 맞습니다.";
  const directorSummaryCard = (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-5">
      <p className="text-[14px] text-gray-800 leading-[1.9]">{result.overall_critique}</p>
    </div>
  );
  const cardStudioSection = (
    <section className="py-10 border-b border-gray-100">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Card Studio</p>
      <p className="text-[22px] font-black text-gray-900 mb-2">결과 카드 디자인 테스트</p>
      <p className="text-[13px] text-gray-500 mb-6">프레임은 유지하고, 사진·점수·평가·스티커만 바뀌는 카드 편집 프리뷰입니다.</p>

      <div
        ref={cardStageRef}
        className="relative mx-auto w-full max-w-[380px] aspect-[677/938] overflow-hidden rounded-[40px] shadow-[0_26px_70px_rgba(0,0,0,0.16)] select-none"
        style={{ backgroundColor: selectedCardTheme.frameColor }}
      >
        <div className="absolute left-[3.6928%] top-[2.026%] h-[95.95%] w-[92.615%] overflow-hidden rounded-[30px] bg-white">
          <div className="absolute inset-0 overflow-hidden">
            {cardPreviewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardPreviewImage}
                alt="결과 카드 미리보기"
                className="absolute left-[-8%] top-[-4%] h-[108%] w-[116%] max-w-none object-cover"
                style={{ objectPosition: "center 20%" }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[#f3f3f3] text-[14px] font-bold text-gray-400">
                사진 없음
              </div>
            )}
            <div className="absolute left-[-26.3%] top-[53.9%] h-[46.2%] w-[156.9%] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.82)_100%)] opacity-70" />
          </div>

          <div
            className="absolute left-1/2 top-0 inline-flex h-[7.67%] max-w-[78%] min-w-[40%] -translate-x-1/2 items-center justify-center gap-3 rounded-b-[18px] px-5 text-black"
            style={{ backgroundColor: selectedCardTheme.frameColor, fontFamily: "var(--font-unbounded)" }}
          >
            <div style={{ fontSize: "24px", fontWeight: 600, flexShrink: 0 }}>
              {selectedCardTheme.titleEmoji[0]}
            </div>
            <div
              className="truncate text-center uppercase"
              style={{ fontSize: "clamp(14px, 3vw, 20px)", fontWeight: 600, letterSpacing: "0.09em" }}
            >
              {cardTitle}
            </div>
            <div style={{ fontSize: "24px", fontWeight: 600, flexShrink: 0 }}>
              {selectedCardTheme.titleEmoji[1]}
            </div>
          </div>

          <div className="absolute left-[18%] top-[66.3%] w-[64%]">
            <div className="rounded-[16px] bg-black/78 px-4 py-2 text-center text-white shadow-[0_12px_24px_rgba(0,0,0,0.28)] backdrop-blur-[2px]">
              <div
                className="uppercase"
                style={{
                  color: selectedCardTheme.accentTextColor,
                  fontFamily: "var(--font-outfit)",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  lineHeight: 1.1,
                }}
              >
                SCENE DIRECTION
              </div>
              <div
                className="mt-1.5 break-keep"
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontSize: "10px",
                  fontWeight: 700,
                  lineHeight: 1.28,
                  letterSpacing: "-0.01em",
                }}
              >
                {cardCueLine || "씬 지시문이 여기에 표시됩니다."}
              </div>
            </div>
          </div>

          <div
            className="absolute bottom-0 left-[19%] h-[18.2%] w-[62%] overflow-hidden rounded-t-[18px]"
            style={{ backgroundColor: selectedCardTheme.frameColor }}
          >
            <div className="absolute left-[4.5%] top-[8%] flex h-[82%] w-[91%] flex-col gap-[6%]">
              {[
                { label: "연기 점수", value: actingScore },
                { label: "감정 폭", value: emotionalRangeScore },
                { label: "화면 장악력", value: screenPresenceScore },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex h-[29%] min-h-0 items-center rounded-[18px] border border-black px-[5.25%]"
                  style={{ backgroundColor: selectedCardTheme.frameColor }}
                >
                  <div className="flex w-full items-center justify-between gap-4" style={{ fontFamily: '"Pretendard", sans-serif' }}>
                    <span className="whitespace-nowrap text-[11px] font-bold leading-none text-black sm:text-[15px]">{item.label}</span>
                    <span className="text-[16px] font-black leading-none text-black sm:text-[22px]">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {cardStickers.map(sticker => (
            <button
              key={sticker.id}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setSelectedStickerId(sticker.id);
                activeStickerPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                const sameStickerPointers = activeStickerPointersRef.current.size;
                if (sameStickerPointers >= 2) {
                  const [a, b] = [...activeStickerPointersRef.current.values()];
                  pinchStateRef.current = {
                    stickerId: sticker.id,
                    startDistance: Math.hypot(a.x - b.x, a.y - b.y),
                    startSize: sticker.size,
                  };
                  draggingStickerIdRef.current = null;
                  return;
                }
                draggingStickerIdRef.current = sticker.id;
              }}
              className={`absolute z-[3] cursor-grab active:cursor-grabbing ${selectedStickerId === sticker.id ? "drop-shadow-[0_0_0_2px_rgba(255,255,255,0.92)]" : ""}`}
              style={{
                left: `${sticker.x * 100}%`,
                top: `${sticker.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${sticker.rotate}deg)`,
                fontSize: `${sticker.size}px`,
                lineHeight: 1,
                touchAction: "none",
                fontFamily: "var(--font-unbounded)",
              }}
            >
              {sticker.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.24em] mb-3">Template</p>
          <div className="flex flex-wrap gap-3">
            {CARD_THEMES.map(theme => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedCardThemeId(theme.id)}
                aria-label={theme.label}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${selectedCardThemeId === theme.id ? "scale-110 border-gray-900 shadow-[0_10px_18px_rgba(0,0,0,0.16)]" : "border-white shadow-[0_4px_10px_rgba(0,0,0,0.10)]"}`}
                style={{ backgroundColor: theme.frameColor }}
              >
                <span className="sr-only">{theme.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-gray-500">색상 칩을 눌러 카드 프레임 톤을 바꿉니다.</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.24em]">Stickers</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={removeLastCardSticker} className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black text-gray-600">
                마지막 삭제
              </button>
              <button type="button" onClick={resetCardStickers} className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black text-gray-600">
                초기화
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CARD_STICKER_CHOICES.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => addCardSticker(emoji)}
                className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-[18px]"
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-gray-500">스티커를 선택한 뒤 드래그로 위치를 바꾸고, 모바일에서는 두 손가락으로 벌리거나 오므려 크기를 조절하세요.</p>
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.18); opacity: 1; }
        }
        @keyframes scan-line {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(18px); opacity: 1; }
        }
      `}</style>

      {/* ── 공유 크레딧 보상 토스트 ──────────────────────── */}
      {shareRewardToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-[13px] font-bold px-5 py-3 rounded-full shadow-xl flex items-center gap-2"
          style={{ animation: "fade-up 0.3s ease-out" }}>
          <span>🎉</span><span>1크레딧 지급됐어요!</span>
        </div>
      )}

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 h-[52px] flex items-center justify-between px-4">
        <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        <div className="flex items-center gap-2">
          {credits !== null && (
            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">{credits}크레딧</span>
          )}
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">AI 오디션 결과</span>
        </div>
      </header>

      <div className="max-w-sm mx-auto px-5 pb-40">
        {/* ══ SECTION 1: 배역 판정 HERO ════════════════════ */}
        <section className="pt-10 pb-10 border-b border-gray-100">
          <p className="text-[11px] font-black text-[#C9571A] tracking-[0.3em] uppercase mb-4">Casting Result</p>

          {/* 배역명 — 이탤릭 없음 */}
          <h1 className="text-[34px] font-black text-gray-900 leading-tight mb-1">
            {bestScene.assigned_role}
          </h1>
          <p className="text-[13px] text-gray-400 mb-6">{GENRE_EMOJIS[bestScene.genre] ?? "🎬"} {bestScene.genre} 베스트 씬 기준</p>

          {/* 종합점수 + 등급 + 아키타입 */}
          <div className="bg-gray-50 rounded-2xl px-5 py-5 mb-5 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">종합 점수</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[60px] font-black leading-none tabular-nums" style={{ color: grade.color }}>{overallAvg}</span>
                <span className="text-[15px] font-bold text-gray-400">/ 100</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-[15px] font-black px-3.5 py-1.5 rounded-full border-2" style={{ color: grade.color, borderColor: grade.color }}>
                {grade.label}
              </span>
              {physio && (
                <span className="text-[12px] font-black text-gray-900 bg-gray-200 rounded-full px-3 py-1">{physio.archetype}</span>
              )}
            </div>
          </div>

          {/* 감독 한마디 — 세로 막대 구분 */}
          <div className="flex gap-4">
            <div className="w-[4px] rounded-full bg-[#C9571A] flex-shrink-0 self-stretch min-h-[40px]" />
            <div>
              <p className="text-[10px] font-black text-[#C9571A] tracking-widest uppercase mb-2">감독 한마디</p>
              <p className="text-[18px] font-black text-gray-900 leading-snug">{result.overall_one_liner}</p>
            </div>
          </div>

          {directorSummaryCard}
        </section>

        {cardStudioSection}

        {/* ══ SECTION 2: AI 스틸컷 (선택 유료) ════════════ */}
        <section className="py-10 border-b border-gray-100">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">AI Still Cut</p>
          <p className="text-[22px] font-black text-gray-900 mb-1">
            {GENRE_EMOJIS[bestScene.genre] ?? "🎬"} {bestScene.genre} 베스트 씬
          </p>
          <p className="text-[13px] text-gray-400 mb-5">내 얼굴 기반으로 AI가 영화 스틸컷 장면을 생성합니다</p>

          {stillImage ? (
            <>
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillImage} alt="AI 스틸컷" className="w-full h-full object-cover" />
                {userPhotos[bestSceneIdx] && (
                  <div className="absolute bottom-3 left-3 w-[72px] h-[72px] rounded-xl overflow-hidden border-2 border-white shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={userPhotos[bestSceneIdx]} alt="내 연기" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <p className="text-[12px] text-gray-400 leading-relaxed">AI가 베스트 씬 촬영 이미지를 기반으로 생성한 스틸컷입니다.</p>
            </>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
              {/* 내 촬영컷 미리보기 */}
              {userPhotos[bestSceneIdx] && (
                <div className="relative w-full aspect-square overflow-hidden bg-[#111]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={userPhotos[bestSceneIdx]}
                    alt="내 연기"
                    className="w-full h-full object-cover opacity-20 scale-[1.06]"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${userPhotos[bestSceneIdx]})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                      filter: "blur(18px) saturate(0.65) brightness(0.58)",
                      transform: "scale(1.08)",
                    }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.34)_0%,rgba(8,8,8,0.52)_44%,rgba(8,8,8,0.68)_100%)]" />
                  <div
                    className="absolute inset-0 opacity-70"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 10px, rgba(0,0,0,0.14) 10px 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 10px, rgba(0,0,0,0.14) 10px 20px)",
                    }}
                  />
                  <div className="absolute left-0 right-0 top-0 h-[72px] bg-gradient-to-b from-black/32 to-transparent" />
                  <div className="absolute left-5 right-5 top-5 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.28em] text-white/55">
                    <span>Locked Preview</span>
                    <span>AI Still Cut</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center p-7">
                    <div className="w-full max-w-[280px] rounded-[28px] border border-white/10 bg-black/22 backdrop-blur-[2px] shadow-[0_24px_60px_rgba(0,0,0,0.28)] overflow-hidden">
                      <div className="h-[52px] border-b border-white/8 bg-white/[0.03] flex items-center justify-between px-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/48">Generating</span>
                        <span className="h-2.5 w-2.5 rounded-full bg-[#C9571A] shadow-[0_0_18px_rgba(201,87,26,0.5)]" />
                      </div>
                      <div className="px-6 py-8 flex flex-col items-center gap-3">
                        <span className="text-white text-[40px]">✦</span>
                        <p className="text-white font-black text-[16px]">AI 스틸컷으로 변환</p>
                        <p className="text-white/72 text-[12px] text-center leading-relaxed">이 장면을 영화 스틸컷 분위기로<br />AI가 다시 그려드립니다</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="px-5 py-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">생성 방식</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="flex flex-col gap-2.5 mb-5">
                  {[
                    { icon: "🎞️", text: "베스트 씬 촬영본 기반 생성" },
                    { icon: "🎨", text: "장르 분위기에 맞는 영화적 색감" },
                    { icon: "🪄", text: "AI가 얼굴 특징 보존 후 씬 합성" },
                  ].map(item => (
                    <div key={item.text} className="flex items-center gap-3">
                      <span className="text-[15px]">{item.icon}</span>
                      <p className="text-[13px] text-gray-700 font-medium">{item.text}</p>
                    </div>
                  ))}
                </div>
                {isGeneratingStill ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="w-5 h-5 rounded-full border-2 border-transparent border-t-[#C9571A]" style={{ animation: "spin 0.8s linear infinite" }} />
                    <span className="text-[13px] text-gray-500 font-medium">스틸컷 생성 중...</span>
                  </div>
                ) : (credits ?? 0) >= 3 ? (
                  <button
                    onClick={handleGenerateStill}
                    className="w-full bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-4 rounded-2xl text-[16px] transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="text-[11px] bg-white/20 rounded-lg px-2 py-0.5 font-black">3크레딧</span>
                    스틸컷 생성하기
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[12px] text-[#C9571A] font-bold text-center">크레딧이 부족해요 (보유: {credits ?? 0}크레딧)</p>
                    <Link href="/shop" className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl text-[15px] text-center transition-colors hover:bg-gray-700">
                      크레딧 충전하기
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ══ SECTION 3: 씬별 연기 분석 ══════════════════════ */}
        <section className="py-10 border-b border-gray-100">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Scene Analysis</p>
          <p className="text-[22px] font-black text-gray-900 mb-5">씬별 연기 분석</p>

          {result.personality_summary && (
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden mb-6">
              <div className="px-5 py-4 bg-[#FFF7F2] border-b border-[#C9571A]/10">
                <p className="text-[10px] font-black text-[#C9571A] uppercase tracking-[0.24em] mb-2">Balance Game</p>
                <p className="text-[17px] font-black text-gray-900 leading-snug">
                  {result.personality_summary}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                  {balanceFunSummary}
                </p>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 gap-3">
                {personalityAnswers.length > 0 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">성향 좌표</p>
                    <div className="relative mx-auto h-[180px] w-full max-w-[240px] rounded-2xl border border-gray-200 bg-white">
                      <div className="absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-gray-200" />
                      <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-gray-200" />
                      <div className="absolute left-3 top-3 text-[11px] font-bold text-gray-400">신중형</div>
                      <div className="absolute right-3 top-3 text-[11px] font-bold text-gray-400">직진형</div>
                      <div className="absolute left-3 bottom-3 text-[11px] font-bold text-gray-400">안정형</div>
                      <div className="absolute right-3 bottom-3 text-[11px] font-bold text-gray-400">주도형</div>
                      <div
                        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#C9571A] shadow-[0_6px_18px_rgba(201,87,26,0.35)]"
                        style={{
                          left: `${balanceAxes.xScore}%`,
                          top: `${100 - balanceAxes.yScore}%`,
                        }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white px-3 py-3 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">X축</p>
                        <p className="text-[14px] font-black text-gray-900">{balanceAxes.xLabel}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Y축</p>
                        <p className="text-[14px] font-black text-gray-900">{balanceAxes.yLabel}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">잘 먹힌 씬</p>
                  <p className="text-[15px] font-black text-gray-900">
                    {GENRE_EMOJIS[bestScene.genre] ?? "🎬"} {bestScene.genre}
                  </p>
                  <p className="mt-1 text-[12px] text-gray-600">감정선을 숨기기보다 바로 드러내는 톤이 이번 씬에서 가장 자연스럽게 붙었습니다.</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">추천 배역 톤</p>
                  <p className="text-[15px] font-black text-gray-900">{bestToneLabel}</p>
                  <p className="mt-1 text-[12px] text-gray-600">{bestScene.assigned_role} 같은 결이 지금 결과에서 제일 잘 받아졌어요.</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">덜 맞은 결</p>
                  <p className="text-[15px] font-black text-gray-900">
                    {GENRE_EMOJIS[weakestScene.genre] ?? "🎬"} {weakestScene.genre}
                  </p>
                  <p className="mt-1 text-[12px] text-gray-600">숨기거나 계산해야 하는 톤은 이번 결과에서 상대적으로 덜 설득력 있게 읽혔습니다.</p>
                </div>
                {personalityAnswers.length > 0 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">근거가 된 선택</p>
                    <div className="flex flex-col gap-2">
                      {[...balanceAxes.xEvidence, ...balanceAxes.yEvidence].slice(0, 3).map((item, index) => (
                        <div key={`${item.category}-${index}`} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                          <p className="text-[11px] font-black text-[#C9571A] mb-1">{item.category}</p>
                          <p className="text-[12px] font-medium leading-snug text-gray-700">{item.question}</p>
                          <p className="mt-1 text-[12px] font-black text-gray-900">{item.choice}: {item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 씬 탭 */}
          <div className="flex gap-2 mb-6">
            {result.scenes.map((scene, i) => (
              <button
                key={i}
                onClick={() => setActiveSceneTab(i)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all flex flex-col items-center gap-0.5 ${
                  activeSceneTab === i ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                <span>씬 {i + 1}</span>
                <span className={`text-[10px] font-medium ${activeSceneTab === i ? "text-[#C9571A]" : "text-gray-400"}`}>
                  {GENRE_EMOJIS[scene.genre] ?? "🎬"} {scene.genre}
                </span>
              </button>
            ))}
          </div>

          {/* 활성 씬 콘텐츠 */}
          {(() => {
            const scene = result.scenes[activeSceneTab];
            const sa = avgScore(scene.scores);
            return (
              <div className="flex flex-col gap-4">
                {/* 씬 헤더 — 장르 + 큐 + 점수 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[13px] font-black text-[#C9571A] uppercase tracking-widest mb-1">
                      씬 {activeSceneTab + 1} · {GENRE_EMOJIS[scene.genre] ?? "🎬"} {scene.genre}
                    </p>
                    <p className="text-[15px] font-bold text-gray-900 leading-snug" style={{ wordBreak: 'keep-all' }}>
                      {genres[activeSceneTab]?.cue}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[36px] font-black leading-none tabular-nums" style={{ color: scoreColor(sa) }}>{sa}</span>
                    <span className="text-[11px] text-gray-400">/ 100</span>
                  </div>
                </div>

                {/* 사진 + 배정역할 오버레이 (하단 풀) */}
                {userPhotos[activeSceneTab] && (
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={userPhotos[activeSceneTab]} alt={`씬 ${activeSceneTab + 1}`} className="w-full h-full object-cover" />
                    {/* 배정역할 — 하단 전체 영역 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-5 pb-5 pt-10">
                      <p className="text-[10px] font-black text-[#C9571A] uppercase tracking-[0.3em] mb-1.5">배정 역할</p>
                      <p className="text-[26px] font-black text-white leading-tight">{scene.assigned_role}</p>
                    </div>
                  </div>
                )}

                {/* 감독 평가 */}
                <div className="flex gap-3">
                  <div className="w-[3px] rounded-full bg-gray-200 flex-shrink-0 self-stretch" />
                  <div>
                    <p className="text-[10px] font-black text-[#C9571A] tracking-widest uppercase mb-1.5">감독 평가</p>
                    <p className="text-[14px] text-gray-800 leading-relaxed">{scene.critique}</p>
                  </div>
                </div>

                {(scene.direction_fit || scene.emotion_read) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {scene.direction_fit && (
                      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">지시문 적합도</p>
                        <p className="text-[13px] font-semibold text-gray-900 leading-relaxed">{scene.direction_fit}</p>
                      </div>
                    )}
                    {scene.emotion_read && (
                      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">실제 읽힌 감정</p>
                        <p className="text-[13px] font-semibold text-gray-900 leading-relaxed">{scene.emotion_read}</p>
                      </div>
                    )}
                  </div>
                )}

                {Array.isArray(scene.evidence_points) && scene.evidence_points.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">근거 포인트</p>
                    <div className="flex flex-col gap-2">
                      {scene.evidence_points.slice(0, 3).map((point, index) => (
                        <div key={`${point}-${index}`} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                          <p className="text-[13px] font-medium text-gray-800 leading-snug">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 점수 바 */}
                <div className="bg-gray-50 rounded-2xl px-4 py-4 flex flex-col gap-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">세부 점수</p>
                  {SCORE_LABELS.map(label => (
                    <ScoreBar key={label} label={label} value={scene.scores[label] ?? 0} />
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        {/* ══ SECTION 4: 관상학 정밀 분석 ═══════════════════ */}
        {physio && (
          <section className="py-10 border-b border-gray-100">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Physiognomy Analysis</p>
            <p className="text-[22px] font-black text-gray-900 mb-5">관상학 정밀 분석</p>

            {physioNeedsRetry ? (
              <div className="flex flex-col gap-4">
                {physioPhoto && (
                  <div className="rounded-[28px] overflow-hidden border border-gray-200 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={physioPhoto} alt="관상 분석 입력 사진" className="w-full aspect-[4/5] object-cover" />
                  </div>
                )}
                <div className="rounded-2xl border border-[#C9571A]/20 bg-[#FFF7F2] px-5 py-5">
                  <p className="text-[11px] font-black text-[#C9571A] uppercase tracking-[0.24em] mb-2">Retry Required</p>
                  <p className="text-[20px] font-black text-gray-900 leading-tight mb-2">정면 얼굴이 아니라서 관상 포인트를 읽지 못했습니다.</p>
                  <p className="text-[14px] text-gray-700 leading-relaxed">
                    {physio.verdict || physio.archetype_reason}
                  </p>
                  <div className="mt-4 rounded-xl bg-white border border-gray-200 px-4 py-4">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">재촬영 가이드</p>
                    <div className="flex flex-col gap-2 text-[13px] text-gray-700">
                      <p>정면을 본 얼굴 사진 1장만 넣어주세요.</p>
                      <p>눈, 코, 입, 턱선이 프레임 안에 모두 들어와야 합니다.</p>
                      <p>상반신이나 몸 사진, 가려진 얼굴, 측면 사진은 판독하지 않습니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* 관상 사진 + 얼굴형/아키타입 오버레이 */}
            {physioPhoto && (
              <div className="mb-6">
                <PhysioScanVisual src={physioPhoto} />
                <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black text-[#C9571A] uppercase tracking-widest mb-1">얼굴형</p>
                      <p className="text-[26px] font-black text-gray-900 leading-tight">{physio.face_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">캐릭터</p>
                      <p className="text-[13px] font-black text-[#C9571A] leading-tight">{physio.archetype}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 얼굴형 + 아키타입 — 사진 없을 때만 */}
            {!physioPhoto && (
              <div className="bg-gray-900 rounded-2xl px-5 py-5 mb-5 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">얼굴형</p>
                    <p className="text-[22px] font-black">{physio.face_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">캐릭터</p>
                    <p className="text-[14px] font-black text-[#C9571A]">{physio.archetype}</p>
                  </div>
                </div>
                <p className="text-[13px] text-gray-300 leading-relaxed">{physio.archetype_reason}</p>
              </div>
            )}

            {/* 아키타입 한줄 설명 (사진 있을 때) */}
            {physioPhoto && (
              <div className="flex gap-3 mb-5">
                <div className="w-[3px] rounded-full bg-[#C9571A] flex-shrink-0 self-stretch" />
                <p className="text-[14px] text-gray-700 leading-relaxed">{physio.archetype_reason}</p>
              </div>
            )}

            {(physio.screen_impression || physio.casting_frame) && (
              <div className="grid grid-cols-1 gap-3 mb-5">
                {physio.screen_impression && (
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">화면 첫인상</p>
                    <p className="text-[13px] font-semibold text-gray-900 leading-relaxed">{physio.screen_impression}</p>
                  </div>
                )}
                {physio.casting_frame && (
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">캐스팅 프레임</p>
                    <p className="text-[13px] font-semibold text-gray-900 leading-relaxed">{physio.casting_frame}</p>
                  </div>
                )}
              </div>
            )}

            {Array.isArray(physio.feature_readings) && physio.feature_readings.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 mb-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">얼굴 포인트 리딩</p>
                <div className="flex flex-col gap-2">
                  {physio.feature_readings.slice(0, 3).map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                      <p className="text-[13px] font-medium text-gray-800 leading-snug">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 탭 네비게이션 */}
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {["얼굴형 해설", "강점", "주의점", "캐릭터", "최적 장르"].map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActivePhysioTab(i)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-black transition-all ${
                    activePhysioTab === i
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            {activePhysioTab === 0 && faceGuide && (
              <div className="flex flex-col gap-4">
                <p className="text-[14px] text-gray-700 leading-relaxed">{faceGuide.desc}</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 bg-green-50 rounded-xl px-4 py-3.5 border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">적합 배역</p>
                      <p className="text-[13px] text-gray-700">{faceGuide.acting}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-orange-50 rounded-xl px-4 py-3.5 border border-orange-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">주의할 점</p>
                      <p className="text-[13px] text-gray-700">{faceGuide.caution}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9571A] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-0.5">개선 방법</p>
                      <p className="text-[13px] text-gray-700">{faceGuide.tip}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePhysioTab === 1 && (
              <div className="flex flex-col gap-2.5">
                {physio.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 bg-green-50 rounded-xl px-4 py-3.5 border border-green-100">
                    <span className="text-[16px] mt-0.5 flex-shrink-0">✦</span>
                    <p className="text-[13px] text-gray-800 leading-snug">{s}</p>
                  </div>
                ))}
              </div>
            )}

            {activePhysioTab === 2 && (
              <div className="flex flex-col gap-2.5">
                {physio.weaknesses.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 bg-orange-50 rounded-xl px-4 py-3.5 border border-orange-100">
                    <span className="text-[14px] mt-0.5 flex-shrink-0">⚠</span>
                    <p className="text-[13px] text-gray-800 leading-snug">{w}</p>
                  </div>
                ))}
              </div>
            )}

            {activePhysioTab === 3 && archetypeGuide && (
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-gray-900 px-5 py-4">
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">{physio.archetype}</p>
                  <p className="text-[13px] text-gray-300 leading-relaxed">{archetypeGuide.summary}</p>
                </div>
                <div className="flex flex-col divide-y divide-gray-100">
                  {[
                    { icon: "💪", label: "핵심 강점", content: archetypeGuide.strength },
                    { icon: "🎯", label: "사각지대", content: archetypeGuide.blind_spot },
                    { icon: "📌", label: "감독의 조언", content: archetypeGuide.advice },
                  ].map(item => (
                    <div key={item.label} className="flex gap-3 px-5 py-4">
                      <span className="text-[16px] flex-shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                        <p className="text-[13px] text-gray-700 leading-snug">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePhysioTab === 4 && (
              <div className="bg-gray-50 rounded-2xl px-5 py-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[22px]">{GENRE_EMOJIS[physio.best_genre] ?? "🎬"}</span>
                  <div>
                    <p className="text-[10px] font-black text-[#C9571A] uppercase tracking-widest mb-0.5">최적 장르</p>
                    <p className="text-[18px] font-black text-gray-900">{physio.best_genre}</p>
                  </div>
                </div>
                <p className="text-[14px] text-gray-700 leading-relaxed">{physio.verdict}</p>
              </div>
            )}
              </>
            )}
          </section>
        )}

        {/* ══ SECTION 6: 공유 CTA ═══════════════════════════ */}
        <section className="pt-10 pb-4">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Share</p>
          <p className="text-[22px] font-black text-gray-900 mb-6">결과 공유하기</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleKakaoShare}
              disabled={isSharing}
              className="w-full flex items-center justify-center gap-2 bg-[#FEE500] hover:bg-[#F0D900] disabled:opacity-60 text-[#191919] font-bold py-4 rounded-2xl text-[15px] transition-colors"
            >
              {isSharing ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#191919]/30 border-t-[#191919]" style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
                </svg>
              )}
              {isSharing ? "링크 생성 중..." : "카카오로 공유하기"}
            </button>

            <p className="px-1 text-[13px] font-bold text-[#C9571A]">📢 카카오로 공유하면 1크레딧 지급! (최초 1회)</p>

            <button
              onClick={handleCopyLink}
              disabled={isCopying}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-[15px] transition-colors"
            >
              {isCopying ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white" style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6.5 3.5H3.5a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9.5M9.5 1.5h5m0 0v5m0-5L7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {isCopying ? "링크 생성 중..." : "링크 복사"}
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl text-[14px] transition-colors disabled:opacity-40"
              >
                {isSaving ? (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-gray-700" style={{ animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                저장
              </button>
              <Link
                href="/studio"
                className="flex-1 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl text-[14px] transition-colors"
              >
                나가기
              </Link>
            </div>
          </div>

          {/* 친구 초대 섹션 */}
          {userId && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[18px]">🎁</span>
                <p className="text-[15px] font-black text-gray-900">친구 초대하고 크레딧 받기</p>
              </div>
              <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
                친구가 내 링크로 가입하면<br />
                <span className="text-gray-900 font-bold">나 +2크레딧, 친구 +2크레딧</span> 동시 지급
              </p>
              <button
                onClick={async () => {
                  const refUrl = `${window.location.origin}/api/auth/kakao?ref=${userId}`;
                  await navigator.clipboard.writeText(refUrl).catch(() => {});
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2500);
                }}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-[14px] transition-colors"
              >
                {referralCopied ? (
                  <><span>✓</span><span>링크 복사됨!</span></>
                ) : (
                  <><span>🔗</span><span>초대 링크 복사</span></>
                )}
              </button>
            </div>
          )}

          {copyToast && (
            <div className="mt-3 text-center text-[12px] text-green-600 font-bold">링크가 복사됐어요!</div>
          )}
        </section>

      </div>
    </div>
  );
}
