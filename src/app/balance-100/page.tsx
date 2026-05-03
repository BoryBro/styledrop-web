"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLabFeatureAvailability } from "@/hooks/useLabFeatureAvailability";
import { trackClientEvent } from "@/lib/client-events";
import { BALANCE_100_LAB_ENABLED } from "@/lib/feature-flags";
import {
  BALANCE_LEVELS,
  BALANCE_QUESTION_COUNTS,
  analyzeBalanceAnswers,
  getBalance100Progress,
  getBalanceQuestions,
  getFirstUnansweredIndex,
  normalizeBalanceQuestionCount,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceLevel,
  type BalanceQuestionCount,
  type BalanceQuestion,
  type BalanceResultSummary,
} from "@/lib/balance-100";
import { BALANCE_100_CONTROL_ID } from "@/lib/style-controls";

type Mode = "intro" | "quiz" | "result";
type SessionStatus = "in_progress" | "completed" | "closed";

type BalanceServerSession = {
  sessionId: string;
  ownerUserId: string;
  ownerName: string;
  level: BalanceLevel;
  questionCount: BalanceQuestionCount;
  answers: BalanceAnswers;
  status: SessionStatus;
  result: BalanceResultSummary | null;
  representativeImageUrl?: string;
  predictionToken?: string;
  updatedAt?: string;
  completedAt: string | null;
};

type BalanceMatchItem = {
  sessionId: string;
  ownerName: string;
  questionCount: BalanceQuestionCount;
  answers: BalanceAnswers;
  matchedCount: number;
  percent: number;
  typeTitle: string;
};

type KakaoShareSDK = {
  init?: (key: string | undefined) => void;
  isInitialized?: () => boolean;
  Share?: {
    sendDefault?: (options: {
      objectType: "text";
      text: string;
      link: {
        mobileWebUrl: string;
        webUrl: string;
      };
    }) => void;
  };
};

class PredictionShareLinkError extends Error {}

class ClipboardCopyError extends Error {}

const GREEN = "#20D879";
const BALANCE_OWNER_NAME_STORAGE_KEY = "styledrop_balance_100_owner_name";
const STORY_IMAGE_WIDTH = 1080;
const STORY_IMAGE_HEIGHT = 1920;

function getBalanceOwnerNameStorageKey(level: BalanceLevel, questionCount: BalanceQuestionCount) {
  return `${BALANCE_OWNER_NAME_STORAGE_KEY}:${level}:${questionCount}`;
}

function readStoredBalanceOwnerName(
  level?: BalanceLevel,
  questionCount?: BalanceQuestionCount,
  options: { includeLegacyFallback?: boolean } = {},
) {
  if (typeof window === "undefined") return "";
  try {
    if (level && questionCount) {
      const storedName = window.localStorage.getItem(getBalanceOwnerNameStorageKey(level, questionCount));
      if (storedName) return storedName.trim().slice(0, 16);
    }

    if (!options.includeLegacyFallback) return "";

    // 기존 사용자의 공통 닉네임은 첫 진입 fallback으로만 사용합니다.
    return (window.localStorage.getItem(BALANCE_OWNER_NAME_STORAGE_KEY) ?? "").trim().slice(0, 16);
  } catch {
    return "";
  }
}

function writeStoredBalanceOwnerName(name: string, level: BalanceLevel, questionCount: BalanceQuestionCount) {
  if (typeof window === "undefined") return;
  const safeName = name.trim().slice(0, 16);
  if (!safeName) return;
  try {
    window.localStorage.setItem(getBalanceOwnerNameStorageKey(level, questionCount), safeName);
  } catch {
    // 저장소 접근이 막혀도 세션 생성 시 서버에는 저장됩니다.
  }
}

function getReusableBalanceAnswers(
  session: BalanceServerSession | null | undefined,
  level: BalanceLevel,
  questionCount: BalanceQuestionCount,
) {
  if (!session?.answers || session.level !== level || session.questionCount >= questionCount) return null;

  const targetQuestionIds = new Set(getBalanceQuestions(level, questionCount).map((question) => question.id));
  const reusableAnswers = Object.fromEntries(
    Object.entries(session.answers).filter(([questionId]) => targetQuestionIds.has(questionId)),
  ) as BalanceAnswers;

  return Object.keys(reusableAnswers).length > 0 ? reusableAnswers : null;
}

async function copyTextToClipboard(text: string) {
  if (typeof window === "undefined") throw new Error("browser only");

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 모바일 인앱 브라우저에서 Clipboard API가 막히는 경우가 있어 아래 방식으로 재시도합니다.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "0";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = window.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    if (!copied) throw new ClipboardCopyError("copy failed");
  } finally {
    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      previousRanges.forEach((range) => selection.addRange(range));
    }
    activeElement?.focus({ preventScroll: true });
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function getWrappedTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3,
) {
  const characters = Array.from(text.replace(/\s+/g, " ").trim());
  const lines: string[] = [];
  let current = "";

  characters.forEach((character) => {
    const next = `${current}${character}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }

    if (current) lines.push(current.trim());
    current = character.trimStart();
  });
  if (current) lines.push(current.trim());

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].replace(/[.。!?…]+$/, "")}...`;
  }

  return visibleLines;
}

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  return drawTextLines(ctx, getWrappedTextLines(ctx, text, maxWidth, maxLines), x, y, lineHeight);
}

function safeStoryFileName(name: string) {
  return name.trim().replace(/[^\w가-힣-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "balance-100";
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("empty canvas"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function applyStoryCanvasPreviewStyle(canvas: HTMLCanvasElement) {
  canvas.style.width = "100%";
  canvas.style.maxWidth = "540px";
  canvas.style.height = "auto";
  canvas.style.display = "block";
  canvas.style.margin = "0 auto";
}

async function downloadBalanceStoryImage({
  userName,
  questionCount,
  answers,
  questions,
}: {
  userName: string;
  questionCount: BalanceQuestionCount;
  answers: BalanceAnswers;
  questions: BalanceQuestion[];
}) {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_IMAGE_WIDTH;
  canvas.height = STORY_IMAGE_HEIGHT;
  applyStoryCanvasPreviewStyle(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const storyFontFamily = '"Pretendard", "SUIT Variable", "Apple SD Gothic Neo", sans-serif';
  const textCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load(`500 54px ${storyFontFamily}`),
      document.fonts.load(`900 102px ${storyFontFamily}`),
      document.fonts.load(`700 43px ${storyFontFamily}`),
      document.fonts.load(`400 32px ${storyFontFamily}`),
      document.fonts.load(`800 68px ${storyFontFamily}`),
      document.fonts.load(`900 60px ${storyFontFamily}`),
      document.fonts.load(`700 48px ${storyFontFamily}`),
    ]);
  }

  const displayName = userName.trim() || "사용자";
  const answeredQuestions = questions.filter((question) => answers[question.id]);
  const provocativeKeywords = ["속옷", "질투", "플러팅", "전 애인", "단둘이", "비밀", "뒷담", "스킨십", "고백", "폭로", "몰래", "애인"];
  const scoreStoryQuestion = (question: BalanceQuestion) => (
    question.heat +
    provocativeKeywords.reduce((score, keyword) => (
      question.left.includes(keyword) || question.right.includes(keyword) ? score + 24 : score
    ), 0)
  );
  const nonFirstAnsweredQuestions = answeredQuestions.filter((question) => questions.findIndex((item) => item.id === question.id) > 0);
  const provocativeAnsweredQuestions = nonFirstAnsweredQuestions.filter((question) => (
    provocativeKeywords.some((keyword) => question.left.includes(keyword) || question.right.includes(keyword))
  ));
  const storyQuestionPool = provocativeAnsweredQuestions.length > 0 ? provocativeAnsweredQuestions : nonFirstAnsweredQuestions;
  const sampleQuestion = [...(storyQuestionPool.length > 0 ? storyQuestionPool : answeredQuestions)]
    .sort((a, b) => scoreStoryQuestion(b) - scoreStoryQuestion(a))
    .slice(0, 1)[0];
  const storyQuestionNumber = sampleQuestion
    ? Math.max(1, questions.findIndex((question) => question.id === sampleQuestion.id) + 1)
    : 1;

  ctx.fillStyle = "#F8FAFF";
  ctx.fillRect(0, 0, STORY_IMAGE_WIDTH, STORY_IMAGE_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = "#EAF4FF";
  ctx.beginPath();
  ctx.arc(-90, 1820, 500, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, 80, 132, 212, 70, 35);
  ctx.fillStyle = "#EFF6FF";
  ctx.fill();
  ctx.fillStyle = "#2563EB";
  ctx.beginPath();
  ctx.arc(114, 167, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `600 31px ${storyFontFamily}`;
  textCtx.letterSpacing = "0.5px";
  ctx.fillText("밸런스 게임", 132, 179);

  ctx.fillStyle = "#64748B";
  ctx.font = `500 54px ${storyFontFamily}`;
  textCtx.letterSpacing = "-0.5px";
  ctx.fillText(`${displayName}님의 선택은`, 80, 318);
  ctx.fillStyle = "#2563EB";
  ctx.font = `900 102px ${storyFontFamily}`;
  textCtx.letterSpacing = "-3px";
  ctx.fillText("어떤걸까요?", 80, 432);
  textCtx.letterSpacing = "0px";

  ctx.strokeStyle = "#BFDBFE";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, 516);
  ctx.lineTo(130, 516);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.font = `700 43px ${storyFontFamily}`;
  drawWrappedText(ctx, `나의 선택과 ${displayName}님의 답변을`, 80, 594, 760, 68, 2);
  ctx.fillText("비교해보세요!", 80, 662);

  ctx.fillStyle = "#94A3B8";
  ctx.font = `400 32px ${storyFontFamily}`;
  drawWrappedText(ctx, `${questionCount}개의 선택으로 서로 얼마나 비슷한지`, 80, 748, 820, 52, 2);
  ctx.fillText("비교하기 게임", 80, 800);

  const cardX = 80;
  const cardY = 880;
  const cardW = 920;
  const cardH = 880;
  ctx.save();
  ctx.shadowColor = "rgba(37, 99, 235, 0.09)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#DCEBFF";
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.stroke();

  ctx.fillStyle = "#2563EB";
  ctx.font = '900 31px "SUIT Variable", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(`Q.${String(storyQuestionNumber).padStart(2, "0")}`, cardX + 72, cardY + 88);
  ctx.fillStyle = "#CBD5E1";
  ctx.font = '900 31px "SUIT Variable", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(`/ ${questionCount}`, cardX + 148, cardY + 88);

  const questionText = sampleQuestion
    ? { left: sampleQuestion.left, right: sampleQuestion.right }
    : { left: "연인이 내 커리어 질투", right: "연인이 내 친구 질투" };
  const questionMaxLength = Math.max(questionText.left.length, questionText.right.length);
  const questionFontSize = questionMaxLength > 14 ? 60 : 68;
  const questionLineHeight = questionMaxLength > 14 ? 86 : 96;
  const questionX = cardX + 72;
  const questionW = cardW - 144;
  const questionStackGap = 24;
  const vsLineHeight = 64;
  ctx.fillStyle = "#111827";
  ctx.font = `800 ${questionFontSize}px ${storyFontFamily}`;
  const leftLines = getWrappedTextLines(ctx, questionText.left, questionW, 2);
  let questionCursorY = drawTextLines(ctx, leftLines, questionX, cardY + 205, questionLineHeight) + questionStackGap;
  ctx.fillStyle = "#2563EB";
  ctx.font = `900 60px ${storyFontFamily}`;
  ctx.fillText("VS", questionX, questionCursorY);
  questionCursorY += vsLineHeight + questionStackGap;
  ctx.fillStyle = "#111827";
  ctx.font = `800 ${questionFontSize}px ${storyFontFamily}`;
  const rightLines = getWrappedTextLines(ctx, questionText.right, questionW, 2);
  const rightBottom = drawTextLines(ctx, rightLines, questionX, questionCursorY, questionLineHeight);

  const answerX = cardX + 72;
  const answerW = cardW - 144;
  const dividerY = Math.max(cardY + 455, rightBottom + 34);
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(answerX, dividerY);
  ctx.lineTo(answerX + answerW, dividerY);
  ctx.stroke();

  ctx.fillStyle = "#94A3B8";
  ctx.font = `400 28px ${storyFontFamily}`;
  ctx.fillText(`${displayName}님의 선택`, answerX, dividerY + 72);

  const answerY = dividerY + 100;
  const answerH = 122;
  ctx.fillStyle = "#EFF6FF";
  roundedRect(ctx, answerX, answerY, answerW, answerH, 18);
  ctx.fill();

  const linkGuideText = "링크 넣는 영역";
  ctx.fillStyle = "rgba(100, 116, 139, 0.24)";
  ctx.font = `700 48px ${storyFontFamily}`;
  ctx.fillText(linkGuideText, answerX + (answerW - ctx.measureText(linkGuideText).width) / 2, answerY + 76);

  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `styledrop-story-${safeStoryFileName(displayName)}-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function TopProgress({
  progressRatio = 0,
  onBack,
  backHref,
}: {
  progressRatio?: number;
  onBack?: () => void;
  backHref?: string;
}) {
  const backClass = "flex h-11 w-11 items-center justify-center text-[38px] font-light leading-none text-black";
  return (
    <div className="flex items-center gap-4 pb-10 pt-3">
      {backHref ? (
        <Link href={backHref} className={backClass} aria-label="뒤로가기">‹</Link>
      ) : (
        <button type="button" onClick={onBack} className={backClass} aria-label="뒤로가기">‹</button>
      )}
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDEDED]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(4, Math.min(100, progressRatio))}%`, backgroundColor: GREEN }}
        />
      </div>
      <div className="w-11" />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[66px] w-full rounded-[34px] text-[19px] font-black text-white shadow-[0_16px_30px_rgba(32,216,121,0.22)] transition disabled:opacity-50"
      style={{ backgroundColor: GREEN }}
    >
      {children}
    </button>
  );
}

function KakaoBubbleIcon() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#191919]" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4.5c-5 0-9 3.15-9 7.04 0 2.48 1.64 4.66 4.12 5.91l-.66 2.42c-.1.37.32.67.64.45l3.05-2.03c.6.09 1.22.14 1.85.14 5 0 9-3.15 9-7.04S17 4.5 12 4.5Z"
          fill="#FEE500"
        />
      </svg>
    </span>
  );
}

function BalanceIntroHeader({ onBack }: { onBack?: () => void }) {
  const backClass = "flex items-center gap-1.5 text-gray-400 transition-colors hover:text-gray-900";
  const backContent = (
    <>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[14px] font-semibold">돌아가기</span>
    </>
  );

  return (
    <header className="sticky top-0 z-40 -mx-6 flex h-14 items-center justify-between border-b border-gray-100 bg-white/90 px-5 backdrop-blur">
      {onBack ? (
        <button type="button" onClick={onBack} className={backClass}>
          {backContent}
        </button>
      ) : (
        <Link href="/studio" className={backClass}>
          {backContent}
        </Link>
      )}
      <div className="flex items-center gap-1.5 rounded-full border border-[#B9F7CD] bg-[#F0FFF7] px-3 py-1">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#12863C]">밸런스 100</span>
        <span className="h-1.5 w-1.5 rounded-full bg-[#20D879]" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Beta</span>
      </div>
      <div className="w-[60px]" />
    </header>
  );
}

function BalanceIntroHero() {
  const orbitItems = ["A", "B", "🤔", "⚖️", "💬"];

  return (
    <section className="flex flex-col items-center px-1 pb-8 pt-14 text-center">
      <div className="relative mb-10 flex items-center justify-center" style={{ height: 104 }}>
        {orbitItems.map((item, index) => {
          const angle = (index / orbitItems.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 40;
          return (
            <div
              key={item}
              className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-[#B9F7CD] bg-[#F0FFF7] text-[17px] font-black text-[#12863C] shadow-sm"
              style={{ transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)` }}
            >
              {item}
            </div>
          );
        })}
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#20D879] text-[20px] font-black text-white shadow-md">
          100
        </div>
      </div>
      <p className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#20D879]">친구 일치율 테스트</p>
      <h1 className="text-[34px] font-black leading-[1.12] tracking-[-0.06em] text-gray-900">밸런스 100</h1>
      <p className="mt-5 break-keep text-[16px] font-bold leading-7 text-gray-500">
        나와 친구가 같은 문항을 고르면
        <br />
        <span className="text-[#12863C]">얼마나 같은지 바로 비교해요</span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["30/50/100문항", "일치율 확인", "친구 공유"].map((tag) => (
          <span key={tag} className="rounded-full border border-[#B9F7CD] bg-[#F0FFF7] px-3 py-1 text-[12px] font-bold text-[#12863C]">
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function ChoiceCard({
  label,
  value,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  value: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[86px] w-full items-center gap-4 rounded-[28px] border bg-white px-6 py-5 text-left transition disabled:opacity-60 ${
        selected ? "border-[#20D879] bg-[#F0FFF7] shadow-[0_10px_24px_rgba(32,216,121,0.12)]" : "border-[#E9E9E9]"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F7F7F7] text-[15px] font-black text-[#9A9A9A]">
        {label}
      </span>
      <span className={`min-w-0 flex-1 break-keep text-[19px] font-bold leading-[1.45] ${selected ? "text-[#111]" : "text-[#2B2B2B]"}`}>
        {value}
      </span>
      {selected && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] font-black text-white" style={{ backgroundColor: GREEN }}>
          ✓
        </span>
      )}
    </button>
  );
}

function ResultReport({
  result,
  userName,
  matches,
  answers,
  questions,
  representativeImageUrl,
}: {
  result: BalanceResultSummary;
  userName: string;
  matches: BalanceMatchItem[];
  answers: BalanceAnswers;
  questions: BalanceQuestion[];
  representativeImageUrl?: string;
}) {
  const displayName = userName.trim() || "사용자";
  const comparableMatches = useMemo(() => matches.slice(0, 10), [matches]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const activeSelectedMatchId = comparableMatches.some((match) => match.sessionId === selectedMatchId)
    ? selectedMatchId
    : comparableMatches[0]?.sessionId ?? "";
  const selectedMatch = comparableMatches.find((match) => match.sessionId === activeSelectedMatchId) ?? null;
  const answeredQuestions = questions
    .map((question, index) => ({
      question,
      index,
      picked: answers[question.id],
    }))
    .filter((item): item is { question: BalanceQuestion; index: number; picked: BalanceAnswerValue } => Boolean(item.picked));

  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-[34px] font-black leading-none tracking-[-0.06em] text-[#111827]">결과</h1>
      <section className="border-b border-[#E5E7EB] pb-7">
        <div>
          <h1 className="break-keep text-[31px] font-black leading-[1.14] tracking-[-0.06em] text-black">
            {displayName}님과
            <br />
            비교한 친구들
          </h1>
          <p className="mt-3 text-[13px] font-black text-[#20D879]">{result.typeTitle}</p>
          {comparableMatches.length > 0 ? (
            <div className="mt-5 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
              {comparableMatches.map((match) => (
                <button
                  key={match.sessionId}
                  type="button"
                  onClick={() => setSelectedMatchId(match.sessionId)}
                  className={`flex w-full items-center justify-between gap-4 py-4 text-left transition ${
                    selectedMatch?.sessionId === match.sessionId ? "bg-[#F0FFF7]" : "bg-white"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-black tracking-[-0.04em] text-[#111827]">{match.ownerName}님</p>
                    <p className="mt-1 text-[12px] font-bold text-[#9CA3AF]">{match.typeTitle} · {match.matchedCount}/{questions.length} 일치</p>
                  </div>
                  <p className="shrink-0 text-[24px] font-black tracking-[-0.06em] text-[#20D879]">{match.percent}%</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 border-y border-[#E5E7EB] py-5">
              <p className="break-keep text-[18px] font-black leading-7 text-[#111827]">
                아직 응답한 친구가 없어요.
              </p>
              <p className="mt-2 break-keep text-[14px] font-bold leading-6 text-[#6B7280]">
                친구가 링크로 답을 완료하면 여기서 바로 비교됩니다.
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[25px] font-black tracking-[-0.05em] text-[#111827]">밸런스 Q&A</h2>
          {selectedMatch && (
            <p className="text-[12px] font-black text-[#20D879]">{selectedMatch.ownerName}님과 비교</p>
          )}
        </div>
        <div className="-mx-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex snap-x snap-mandatory gap-2.5">
            {answeredQuestions.map(({ question, index, picked }) => {
              const friendPicked = selectedMatch?.answers?.[question.id];
              const isSame = Boolean(friendPicked && friendPicked === picked);
              const getOptionClassName = (option: BalanceAnswerValue) => {
                const isMine = picked === option;
                const isFriend = friendPicked === option;
                if (isMine && isFriend) return "border-[#20D879] bg-[#F0FFF7] text-[#111827]";
                if (isMine) return "border-[#FFEDD5] bg-[#FFF7ED] text-[#111827]";
                if (isFriend) return "border-[#DBEAFE] bg-[#EFF6FF] text-[#111827]";
                return "border-transparent bg-transparent text-[#9CA3AF]";
              };

              return (
                <article key={question.id} className="min-h-[210px] min-w-[86%] snap-start border border-[#E5E7EB] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#20D879]">
                      Q{String(index + 1).padStart(2, "0")}
                    </p>
                    <p className={`text-[12px] font-black ${isSame ? "text-[#20D879]" : "text-[#F97316]"}`}>
                      {selectedMatch ? (isSame ? "같은 선택" : "다른 선택") : `내 선택 ${picked}`}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-black text-[#F97316]">나 {picked}</span>
                    {selectedMatch && friendPicked && (
                      <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-black text-[#2563EB]">
                        {selectedMatch.ownerName} {friendPicked}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 text-[14px] font-bold leading-6">
                    <div className={`rounded-2xl border px-3 py-3 ${getOptionClassName("A")}`}>
                      <div className="flex min-h-9 items-start justify-between gap-3">
                        <span className="min-w-0 break-keep">A. {question.left}</span>
                        <span className="flex shrink-0 gap-1">
                          {picked === "A" && <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-black text-[#F97316]">나</span>}
                          {friendPicked === "A" && selectedMatch && <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-black text-[#2563EB]">친구</span>}
                        </span>
                      </div>
                      {picked === "A" && representativeImageUrl && (
                        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F3F4F6]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={representativeImageUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      )}
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 ${getOptionClassName("B")}`}>
                      <div className="flex min-h-9 items-start justify-between gap-3">
                        <span className="min-w-0 break-keep">B. {question.right}</span>
                        <span className="flex shrink-0 gap-1">
                          {picked === "B" && <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-black text-[#F97316]">나</span>}
                          {friendPicked === "B" && selectedMatch && <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-black text-[#2563EB]">친구</span>}
                        </span>
                      </div>
                      {picked === "B" && representativeImageUrl && (
                        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F3F4F6]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={representativeImageUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Balance100Page() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const {
    isLoading: isAvailabilityLoading,
    isVisible: isLabVisible,
    isEnabled: isLabEnabled,
  } = useLabFeatureAvailability(BALANCE_100_CONTROL_ID, BALANCE_100_LAB_ENABLED);
  const [mode, setMode] = useState<Mode>("intro");
  const [serverSession, setServerSession] = useState<BalanceServerSession | null>(null);
  const [completedSessions, setCompletedSessions] = useState<BalanceServerSession[]>([]);
  const [matches, setMatches] = useState<BalanceMatchItem[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<BalanceLevel>(1);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<BalanceQuestionCount>(100);
  const [requestedSessionId, setRequestedSessionId] = useState<string | null | undefined>(undefined);
  const [requestedSessionLoaded, setRequestedSessionLoaded] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [displayOwnerName, setDisplayOwnerName] = useState("");
  const [isOwnerNameSaved, setIsOwnerNameSaved] = useState(false);
  const [answers, setAnswers] = useState<BalanceAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [representativeImageUrl, setRepresentativeImageUrl] = useState<string | undefined>();
  const [shareStatus, setShareStatus] = useState("");
  const [manualShareUrl, setManualShareUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const questions = useMemo(() => getBalanceQuestions(selectedLevel, selectedQuestionCount), [selectedLevel, selectedQuestionCount]);
  const progress = useMemo(() => getBalance100Progress(answers, questions), [answers, questions]);
  const isCompleted = progress.answered >= questions.length;
  const trimmedOwnerName = ownerName.trim();
  const isEmptyInProgressSession = Boolean(
    serverSession &&
    serverSession.status === "in_progress" &&
    progress.answered === 0,
  );
  const reusableCompletedSession = useMemo(() => {
    return completedSessions
      .filter((session) => (
        session.result &&
        session.level === selectedLevel &&
        normalizeBalanceQuestionCount(session.questionCount) < selectedQuestionCount &&
        getReusableBalanceAnswers(session, selectedLevel, selectedQuestionCount)
      ))
      .sort((a, b) => normalizeBalanceQuestionCount(b.questionCount) - normalizeBalanceQuestionCount(a.questionCount))[0] ?? null;
  }, [completedSessions, selectedLevel, selectedQuestionCount]);
  const result = useMemo(
    () => {
      if (serverSession?.result) {
        return serverSession.result.resultStory
          ? serverSession.result
          : isCompleted
            ? analyzeBalanceAnswers(answers, questions)
            : serverSession.result;
      }

      return isCompleted ? analyzeBalanceAnswers(answers, questions) : null;
    },
    [answers, isCompleted, questions, serverSession?.result],
  );
  const question = questions[currentIndex];

  useEffect(() => {
    setRequestedSessionId(new URLSearchParams(window.location.search).get("sessionId"));
  }, []);

  const applySession = useCallback((nextSession: BalanceServerSession | null, nextMatches: BalanceMatchItem[] = []) => {
    setServerSession(nextSession);
    setMatches(nextMatches);
    if (!nextSession) {
      setAnswers({});
      setRepresentativeImageUrl(undefined);
      const storedName = readStoredBalanceOwnerName(1, 100, { includeLegacyFallback: true });
      setOwnerName(storedName);
      setDisplayOwnerName(storedName);
      setIsOwnerNameSaved(Boolean(storedName));
      setCurrentIndex(0);
      setMode("intro");
      return;
    }

    const level = normalizeBalanceLevel(nextSession.level);
    const questionCount = normalizeBalanceQuestionCount(nextSession.questionCount);
    const sessionAnswers = nextSession.answers ?? {};
    const sessionQuestions = getBalanceQuestions(level, questionCount);
    setSelectedLevel(level);
    setSelectedQuestionCount(questionCount);
    setAnswers(sessionAnswers);
    const sessionOwnerName = (nextSession.ownerName || readStoredBalanceOwnerName(level, questionCount)).trim().slice(0, 16);
    setOwnerName(sessionOwnerName);
    setDisplayOwnerName(sessionOwnerName);
    setIsOwnerNameSaved(Boolean(sessionOwnerName));
    setRepresentativeImageUrl(nextSession.representativeImageUrl);
    setCurrentIndex(getFirstUnansweredIndex(sessionAnswers, sessionQuestions));
    setMode("intro");
  }, []);

  const upsertCompletedSession = useCallback((session: BalanceServerSession | null) => {
    if (!session?.result) return;
    setCompletedSessions((prev) => {
      const next = [
        session,
        ...prev.filter((item) => (
          item.sessionId !== session.sessionId &&
          !(item.level === session.level && normalizeBalanceQuestionCount(item.questionCount) === normalizeBalanceQuestionCount(session.questionCount))
        )),
      ];
      return next.sort((a, b) => a.level - b.level || a.questionCount - b.questionCount);
    });
  }, []);

  useEffect(() => {
    if (!user || requestedSessionId === undefined) return;

    fetch("/api/balance-100/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok) {
          setCompletedSessions(Array.isArray(data.completedSessions) ? data.completedSessions : []);
          if (!requestedSessionId) applySession(data.session ?? null, data.matches ?? []);
        }
      })
      .catch(() => undefined);
  }, [applySession, requestedSessionId, user]);

  useEffect(() => {
    if (mode !== "intro") return;
    if (serverSession && !isEmptyInProgressSession) return;
    if (progress.answered > 0) return;

    const storedName = readStoredBalanceOwnerName(selectedLevel, selectedQuestionCount);
    setOwnerName(storedName);
    setDisplayOwnerName(storedName);
    setIsOwnerNameSaved(Boolean(storedName));
  }, [isEmptyInProgressSession, mode, progress.answered, selectedLevel, selectedQuestionCount, serverSession]);

  const startQuiz = useCallback(async () => {
    setShareStatus("");
    if (serverSession && isCompleted) {
      setMode("result");
      return;
    }
    if (serverSession && !(isEmptyInProgressSession && (selectedLevel !== serverSession.level || selectedQuestionCount !== serverSession.questionCount))) {
      setCurrentIndex(getFirstUnansweredIndex(answers, questions));
      setMode("quiz");
      return;
    }
    if (!trimmedOwnerName) {
      setShareStatus("친구에게 보일 닉네임을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    try {
      writeStoredBalanceOwnerName(trimmedOwnerName, selectedLevel, selectedQuestionCount);
      let initialAnswers: BalanceAnswers | undefined;
      const reusableAnswers = getReusableBalanceAnswers(reusableCompletedSession, selectedLevel, selectedQuestionCount);
      if (reusableCompletedSession && reusableAnswers) {
        const ok = window.confirm(
          `이전에 완료한 ${reusableCompletedSession.questionCount}개 답변을 그대로 사용하고 이어서 진행하시겠습니까?`,
        );
        if (ok) initialAnswers = reusableAnswers;
      }
      const response = await fetch("/api/balance-100/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: selectedLevel,
          questionCount: selectedQuestionCount,
          ownerName: trimmedOwnerName,
          restart: Boolean(serverSession),
          answers: initialAnswers,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.session) throw new Error(data?.error ?? "failed");
      applySession(data.session, data.matches ?? []);
      setMode("quiz");
      void trackClientEvent("lab_balance_started", {
        level: selectedLevel,
        questionCount: selectedQuestionCount,
        reusedAnswerCount: initialAnswers ? Object.keys(initialAnswers).length : 0,
      });
    } catch {
      setShareStatus("시작에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, applySession, isCompleted, isEmptyInProgressSession, questions, reusableCompletedSession, selectedLevel, selectedQuestionCount, serverSession, trimmedOwnerName]);

  const resetQuiz = useCallback(async () => {
    const ok = window.confirm("기존 진행 상태를 닫고 처음부터 다시 시작할까요?");
    if (!ok) return;

    setIsSaving(true);
    setShareStatus("");
    try {
      if (trimmedOwnerName) writeStoredBalanceOwnerName(trimmedOwnerName, selectedLevel, selectedQuestionCount);
      const response = await fetch("/api/balance-100/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedLevel, questionCount: selectedQuestionCount, restart: true, ownerName: trimmedOwnerName }),
      });
      const data = await response.json();
      if (!response.ok || !data?.session) throw new Error(data?.error ?? "failed");
      applySession(data.session, []);
      setMode("quiz");
      void trackClientEvent("lab_balance_started", { level: selectedLevel, questionCount: selectedQuestionCount, restart: true });
    } catch {
      setShareStatus("새로 시작하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }, [applySession, selectedLevel, selectedQuestionCount, trimmedOwnerName]);

  const saveSession = useCallback(async (
    sessionId: string,
    nextAnswers: BalanceAnswers,
    nextImageUrl?: string,
  ) => {
    const response = await fetch(`/api/balance-100/session/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: nextAnswers,
        representativeImageUrl: nextImageUrl,
        ownerName: trimmedOwnerName,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.session) throw new Error(data?.error ?? "failed");
    const savedSession = data.session as BalanceServerSession;
    setServerSession(savedSession);
    setMatches(data.matches ?? []);
    setSelectedLevel(normalizeBalanceLevel(savedSession.level));
    setSelectedQuestionCount(normalizeBalanceQuestionCount(savedSession.questionCount));
    setRepresentativeImageUrl(savedSession.representativeImageUrl);
    return data.session as BalanceServerSession;
  }, [trimmedOwnerName]);

  const discardSession = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/balance-100/session/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error ?? "failed");
    setServerSession(null);
    setAnswers({});
    setMatches([]);
    setRepresentativeImageUrl(undefined);
    setCurrentIndex(0);
  }, []);

  const deleteCompletedSession = useCallback(async (target: BalanceServerSession) => {
    const ok = window.confirm("이 완료 기록을 삭제할까요? 삭제하면 다시 볼 수 없어요.");
    if (!ok) return;

    setIsSaving(true);
    setShareStatus("");
    try {
      const response = await fetch(`/api/balance-100/session/${encodeURIComponent(target.sessionId)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "failed");

      setCompletedSessions((prev) => prev.filter((session) => session.sessionId !== target.sessionId));
      if (serverSession?.sessionId === target.sessionId) {
        setServerSession(null);
        setAnswers({});
        setMatches([]);
        setRepresentativeImageUrl(undefined);
        setCurrentIndex(0);
        setMode("intro");
      }
      setShareStatus("완료 기록을 삭제했어요.");
      void trackClientEvent("lab_balance_deleted", {
        level: target.level,
        questionCount: target.questionCount,
      });
    } catch {
      setShareStatus("삭제에 실패했어요.");
    } finally {
      setIsSaving(false);
    }
  }, [serverSession?.sessionId]);

  const pickAnswer = useCallback((value: BalanceAnswerValue) => {
    if (!question || !serverSession || isSaving) return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    setShareStatus("");
  }, [answers, isSaving, question, serverSession]);

  const handleSaveAndExit = useCallback(async () => {
    if (!serverSession) {
      router.push("/studio");
      return;
    }

    setIsSaving(true);
    setShareStatus("");
    try {
      if (progress.answered === 0) {
        await discardSession(serverSession.sessionId);
        router.push("/studio");
        return;
      }
      const saved = await saveSession(serverSession.sessionId, answers, representativeImageUrl);
      if (saved.status === "completed") {
        upsertCompletedSession(saved);
        void trackClientEvent("lab_balance_completed", { level: saved.level, questionCount: saved.questionCount });
      }
      router.push("/studio");
    } catch {
      setShareStatus("저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, discardSession, progress.answered, representativeImageUrl, router, saveSession, serverSession, upsertCompletedSession]);

  const handleFinishQuiz = useCallback(async () => {
    if (!serverSession || !isCompleted) return;

    setIsSaving(true);
    setShareStatus("");
    try {
      const saved = await saveSession(serverSession.sessionId, answers, representativeImageUrl);
      if (saved.status === "completed") {
        upsertCompletedSession(saved);
        void trackClientEvent("lab_balance_completed", { level: saved.level, questionCount: saved.questionCount });
      }
      setMode("result");
    } catch {
      setShareStatus("결과 저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, isCompleted, representativeImageUrl, saveSession, serverSession, upsertCompletedSession]);

  const openCompletedResult = useCallback((session: BalanceServerSession, initialMatches?: BalanceMatchItem[]) => {
    setServerSession(session);
    setSelectedLevel(normalizeBalanceLevel(session.level));
    const questionCount = normalizeBalanceQuestionCount(session.questionCount);
    setSelectedQuestionCount(questionCount);
    setAnswers(session.answers ?? {});
    const level = normalizeBalanceLevel(session.level);
    const sessionOwnerName = (session.ownerName || readStoredBalanceOwnerName(level, questionCount)).trim().slice(0, 16);
    setOwnerName(sessionOwnerName);
    setDisplayOwnerName(sessionOwnerName);
    setIsOwnerNameSaved(Boolean(sessionOwnerName));
    setRepresentativeImageUrl(session.representativeImageUrl);
    setCurrentIndex(getFirstUnansweredIndex(session.answers ?? {}, getBalanceQuestions(level, questionCount)));
    setMatches(initialMatches ?? []);
    setMode("result");
    if (initialMatches) return;
    fetch(`/api/balance-100/session/${encodeURIComponent(session.sessionId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok) setMatches(Array.isArray(data.matches) ? data.matches : []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user || requestedSessionId === undefined || !requestedSessionId || requestedSessionLoaded) return;
    setRequestedSessionLoaded(true);
    fetch(`/api/balance-100/session/${encodeURIComponent(requestedSessionId)}`, { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data?.session) throw new Error("failed");
        const target = data.session as BalanceServerSession;
        upsertCompletedSession(target);
        openCompletedResult(target, Array.isArray(data.matches) ? data.matches : []);
      })
      .catch(() => setShareStatus("기록을 불러오지 못했어요."));
  }, [openCompletedResult, requestedSessionId, requestedSessionLoaded, upsertCompletedSession, user]);

  const createPredictionShareUrl = useCallback(async (sessionId: string) => {
    const shareOwnerName = (displayOwnerName || ownerName || serverSession?.ownerName || user?.nickname || "").trim();
    const response = await fetch(`/api/balance-100/session/${encodeURIComponent(sessionId)}/prediction-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerName: shareOwnerName }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.path) {
      throw new PredictionShareLinkError(
        typeof data?.error === "string" ? data.error : "친구 비교 링크를 만들지 못했어요.",
      );
    }
    if (data.session) upsertCompletedSession(data.session as BalanceServerSession);
    return `${window.location.origin}${data.path}`;
  }, [displayOwnerName, ownerName, serverSession?.ownerName, upsertCompletedSession, user?.nickname]);

  const getCachedPredictionShareUrl = useCallback((sessionId: string) => {
    const targetSession = serverSession?.sessionId === sessionId
      ? serverSession
      : completedSessions.find((session) => session.sessionId === sessionId);

    if (!targetSession?.predictionToken) return null;
    return `${window.location.origin}/balance-100/share?token=${encodeURIComponent(targetSession.predictionToken)}`;
  }, [completedSessions, serverSession]);

  const handleKakaoPredictionShare = useCallback(async (sessionId: string, level?: BalanceLevel, questionCount?: BalanceQuestionCount) => {
    setIsSaving(true);
    setShareStatus("");
    setManualShareUrl("");
    try {
      const shareUrl = await createPredictionShareUrl(sessionId);
      const Kakao = (window as Window & { Kakao?: KakaoShareSDK }).Kakao;
      const isInitialized = Kakao?.isInitialized?.() ?? false;
      if (!isInitialized) {
        Kakao?.init?.(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      }
      const sendDefault = Kakao?.Share?.sendDefault;
      if (!sendDefault) throw new Error("Kakao SDK unavailable");

      sendDefault({
        objectType: "text",
        text: `밸런스 100 결과가 도착했어요.\n100개의 선택을 완료하고, 우리 선택이 얼마나 비슷한지 확인해보세요.`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      });
      setShareStatus(level ? `Lv.${level} · ${questionCount ?? 100}문항 카카오 공유창을 열었어요.` : "카카오 공유창을 열었어요.");
    } catch (error) {
      setShareStatus(
        error instanceof PredictionShareLinkError
          ? error.message
          : "카카오 공유에 실패했어요. 링크 복사를 이용해주세요.",
      );
    } finally {
      window.setTimeout(() => setIsSaving(false), 1200);
    }
  }, [createPredictionShareUrl]);

  const handleCopyPredictionLink = useCallback(async (sessionId: string, level?: BalanceLevel, questionCount?: BalanceQuestionCount) => {
    setIsSaving(true);
    setShareStatus("");
    setManualShareUrl("");
    try {
      const shareUrl = getCachedPredictionShareUrl(sessionId) ?? (await createPredictionShareUrl(sessionId));
      try {
        await copyTextToClipboard(shareUrl);
      } catch {
        setManualShareUrl(shareUrl);
        setShareStatus("브라우저가 자동 복사를 막았어요. 아래 링크를 길게 눌러 복사해주세요.");
        return;
      }
      setShareStatus(level ? `Lv.${level} · ${questionCount ?? 100}문항 친구 비교 링크가 복사됐어요.` : "친구 비교 링크가 복사됐어요.");
      void trackClientEvent("lab_balance_share_link_copy", { level, questionCount });
    } catch (error) {
      setShareStatus(error instanceof PredictionShareLinkError ? error.message : "친구 비교 링크를 만들지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }, [createPredictionShareUrl, getCachedPredictionShareUrl]);

  const handleCopyManualShareUrl = useCallback(async () => {
    if (!manualShareUrl) return;

    try {
      await copyTextToClipboard(manualShareUrl);
      setManualShareUrl("");
      setShareStatus("친구 비교 링크가 복사됐어요.");
    } catch {
      setShareStatus("복사가 계속 막혀요. 아래 링크를 길게 눌러 복사해주세요.");
    }
  }, [manualShareUrl]);

  const handlePredictionShare = useCallback(async () => {
    if (!serverSession) return;
    await handleKakaoPredictionShare(serverSession.sessionId, serverSession.level, serverSession.questionCount);
  }, [handleKakaoPredictionShare, serverSession]);

  const handleSaveStoryImage = useCallback(async () => {
    if (!result) return;
    setIsSaving(true);
    setShareStatus("");
    try {
      await downloadBalanceStoryImage({
        userName: displayOwnerName || ownerName || serverSession?.ownerName || user?.nickname || "사용자",
        questionCount: selectedQuestionCount,
        answers,
        questions,
      });
      setShareStatus("스토리용 이미지가 저장됐어요.");
      void trackClientEvent("lab_balance_story_image_save", {
        level: selectedLevel,
        questionCount: selectedQuestionCount,
      });
    } catch {
      setShareStatus("스토리 이미지 저장에 실패했어요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, displayOwnerName, ownerName, questions, result, selectedLevel, selectedQuestionCount, serverSession?.ownerName, user?.nickname]);

  if (loading || isAvailabilityLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5">
        <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#20D879]" style={{ animation: "spin 1s linear infinite" }} />
      </main>
    );
  }

  if (!isLabVisible || !isLabEnabled) {
    return (
      <main className="min-h-screen bg-white px-6 py-6 text-black">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[38px] font-light leading-none text-black">‹</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance Lab</p>
          <h1 className="mt-4 text-[42px] font-black leading-[1.12] tracking-[-0.06em]">
            지금은 잠시
            <br />
            점검 중이에요
          </h1>
          <p className="mt-5 break-keep text-[17px] font-medium leading-8 text-[#555]">
            어드민에서 현재 실험실 진입을 중지한 상태입니다. 잠시 후 다시 확인해주세요.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white px-6 py-6 text-black">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[38px] font-light leading-none text-black">‹</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance Lab</p>
          <h1 className="mt-4 text-[44px] font-black leading-[1.06] tracking-[-0.07em]">
            밸런스 100
          </h1>
          <p className="mt-5 break-keep text-[17px] font-medium leading-8 text-[#555]">
            선택을 저장하고, 나와 비슷한 사람을 찾는 실험실 카드입니다. 로그인 후 이용할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => login("/balance-100")}
            className="mt-8 h-[64px] rounded-[34px] bg-[#FEE500] text-[18px] font-black text-[#191919]"
          >
            카카오로 시작하기
          </button>
        </div>
      </main>
    );
  }

  if (mode === "result" && result) {
    return (
      <main className="min-h-screen bg-white px-6 pb-8">
        <div className="mx-auto max-w-md">
          <BalanceIntroHeader onBack={() => router.back()} />

          <div className="pt-8">
            <ResultReport
              result={result}
              userName={displayOwnerName || ownerName || serverSession?.ownerName || user?.nickname || "사용자"}
              matches={matches}
              answers={answers}
              questions={questions}
              representativeImageUrl={representativeImageUrl}
            />
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => void handleSaveStoryImage()}
              disabled={isSaving}
              className="flex h-[58px] items-center justify-center rounded-[22px] bg-[#111827] text-[15px] font-black text-white disabled:opacity-50"
            >
              스토리 이미지 저장
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePredictionShare}
                disabled={isSaving}
                className="flex h-[54px] items-center justify-center gap-1.5 rounded-[20px] bg-[#FEE500] text-[13px] font-black text-[#191919] disabled:opacity-50"
              >
                <KakaoBubbleIcon />
                카카오
              </button>
              <button
                type="button"
                onClick={() => serverSession && void handleCopyPredictionLink(serverSession.sessionId, serverSession.level, serverSession.questionCount)}
                disabled={isSaving || !serverSession}
                className="flex h-[54px] items-center justify-center rounded-[20px] border border-[#D9F7E5] bg-[#F0FFF7] text-[13px] font-black text-[#20D879] disabled:opacity-50"
              >
                🔗 Link
              </button>
            </div>
          </div>
          {shareStatus && <p className="mt-3 text-center text-[12px] font-bold text-[#20D879]">{shareStatus}</p>}
          {manualShareUrl && (
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-[#D9F7E5] bg-[#F8FFFB] p-2">
              <input
                readOnly
                value={manualShareUrl}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="복사할 친구 비교 링크"
                className="min-w-0 bg-transparent px-2 text-[12px] font-bold text-[#12863C] outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCopyManualShareUrl()}
                className="rounded-xl bg-[#20D879] px-3 text-[12px] font-black text-white"
              >
                다시 복사
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (mode === "quiz" && question) {
    const answeredValue = answers[question.id];
    const progressRatio = Math.round((progress.answered / questions.length) * 100);

    return (
      <main className="min-h-screen bg-white px-6 py-4 text-black">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col">
          <TopProgress progressRatio={progressRatio} onBack={() => void handleSaveAndExit()} />

          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">
            {currentIndex + 1} / {questions.length} · Level {selectedLevel} · {selectedQuestionCount}문항
          </p>
          <h1 className="mt-5 break-keep text-[34px] font-black leading-[1.23] tracking-[-0.06em] text-black">
            둘 중 하나만
            <br />
            골라봐요 :)
          </h1>
          <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-[#9A9A9A]">
            선택은 화면에만 바로 반영돼요. 나갈 때 현재 단계까지만 저장합니다.
          </p>

          <div className="mt-10 grid gap-4">
            <ChoiceCard
              label="A"
              value={question.left}
              selected={answeredValue === "A"}
              disabled={isSaving}
              onClick={() => pickAnswer("A")}
            />
            <ChoiceCard
              label="B"
              value={question.right}
              selected={answeredValue === "B"}
              disabled={isSaving}
              onClick={() => pickAnswer("B")}
            />
          </div>

          <div className="mt-auto grid gap-3 pb-2 pt-8">
            <PrimaryButton
              disabled={isSaving || !answeredValue}
              onClick={() => {
                if (currentIndex >= questions.length - 1) {
                  if (isCompleted) void handleFinishQuiz();
                  return;
                }
                setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
              }}
            >
              {isSaving ? "저장 중..." : currentIndex >= questions.length - 1 ? "결과 보기" : "다음"}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => void handleSaveAndExit()}
              disabled={isSaving}
              className="h-[54px] rounded-[28px] border border-[#D9F7E5] bg-[#F0FFF7] text-[15px] font-black text-[#20D879] disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "저장하고 나가기"}
            </button>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="h-12 text-[15px] font-bold text-[#9A9A9A]"
              >
                이전 질문
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 pb-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col">
        <BalanceIntroHeader />
        <BalanceIntroHero />

        {progress.answered === 0 && (!serverSession || isEmptyInProgressSession) && (
          <section className="border-t border-gray-50 pt-7">
            <div className="px-1">
              <label htmlFor="balance-owner-name" className="text-[13px] font-black text-[#111827]">
                내 닉네임
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  id="balance-owner-name"
                  value={ownerName}
                  onChange={(event) => {
                    setOwnerName(event.target.value.slice(0, 16));
                    setIsOwnerNameSaved(false);
                  }}
                  placeholder="친구에게 보일 이름"
                  maxLength={16}
                  className="h-[58px] min-w-0 flex-1 rounded-[24px] border border-[#E5E7EB] bg-white px-5 text-[17px] font-black text-[#111827] outline-none transition placeholder:text-[#B7BCC5] focus:border-[#20D879] focus:bg-[#F0FFF7]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!trimmedOwnerName) return;
                    setOwnerName(trimmedOwnerName);
                    setDisplayOwnerName(trimmedOwnerName);
                    writeStoredBalanceOwnerName(trimmedOwnerName, selectedLevel, selectedQuestionCount);
                    setIsOwnerNameSaved(true);
                    setShareStatus("닉네임이 저장됐어요.");
                  }}
                  disabled={!trimmedOwnerName}
                  className="h-[58px] shrink-0 rounded-[24px] bg-[#111827] px-5 text-[15px] font-black text-white disabled:bg-[#D1D5DB]"
                >
                  저장
                </button>
              </div>
              {isOwnerNameSaved && (
                <p className="mt-2 px-1 text-[12px] font-bold text-[#20D879]">저장됨</p>
              )}
            </div>
          </section>
        )}

        {progress.answered === 0 && (!serverSession || isEmptyInProgressSession) && (
          <section className="pt-7">
            <p className="px-1 text-[13px] font-black text-[#111827]">난이도 선택</p>
            <div className="-mx-6 mt-3 flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {BALANCE_LEVELS.map((level) => (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => setSelectedLevel(level.level)}
                  className={`flex aspect-square min-w-[168px] flex-col justify-between rounded-[30px] border p-4 text-left transition ${
                    selectedLevel === level.level
                      ? "border-[#20D879] bg-[#F0FFF7]"
                      : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-black text-[#20D879]">{level.badge}</span>
                      <span className="rounded-full bg-[#F0FFF7] px-2.5 py-1 text-[10px] font-black text-[#20D879]">
                        Lv.{level.level}
                      </span>
                    </div>
                    <p className="mt-4 break-keep text-[25px] font-black leading-[1.08] tracking-[-0.06em] text-[#111827]">
                      {level.title}
                    </p>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line break-keep text-[12px] font-bold leading-5 text-[#6B7280]">{level.description}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {progress.answered === 0 && (!serverSession || isEmptyInProgressSession) && (
          <section className="pt-6">
            <p className="px-1 text-[13px] font-black text-[#111827]">문항 수 선택</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {BALANCE_QUESTION_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSelectedQuestionCount(count)}
                  className={`h-[58px] rounded-[22px] border text-[17px] font-black transition ${
                    selectedQuestionCount === count
                      ? "border-[#20D879] bg-[#F0FFF7] text-[#12863C]"
                      : "border-[#E5E7EB] bg-white text-[#6B7280]"
                  }`}
                >
                  {count}문항
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 grid gap-3">
          <PrimaryButton onClick={startQuiz} disabled={isSaving || (!serverSession && !trimmedOwnerName)}>
            {isSaving
              ? "저장 중..."
              : isCompleted
                ? "결과 보기"
                : progress.answered > 0
                  ? `Lv.${serverSession?.level ?? selectedLevel} · ${serverSession?.questionCount ?? selectedQuestionCount}문항 이어하기`
                  : `Lv.${selectedLevel} · ${selectedQuestionCount}문항 시작하기`}
          </PrimaryButton>
          {progress.answered > 0 && (
            <button
              type="button"
              onClick={resetQuiz}
              disabled={isSaving}
              className="h-[54px] rounded-[28px] border border-[#E5E7EB] bg-white text-[14px] font-black text-[#6B7280] disabled:opacity-50"
            >
              새로 시작하기
            </button>
          )}
          {isCompleted && (
            <button
              type="button"
              onClick={() => setMode("result")}
              className="h-[54px] rounded-[28px] border border-[#D9F7E5] bg-[#F0FFF7] text-[14px] font-black text-[#20D879]"
            >
              결과 다시 보기
            </button>
          )}
          {shareStatus && <p className="text-center text-[12px] font-bold text-[#20D879]">{shareStatus}</p>}
          {manualShareUrl && (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-[#D9F7E5] bg-[#F8FFFB] p-2">
              <input
                readOnly
                value={manualShareUrl}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="복사할 친구 비교 링크"
                className="min-w-0 bg-transparent px-2 text-[12px] font-bold text-[#12863C] outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCopyManualShareUrl()}
                className="rounded-xl bg-[#20D879] px-3 text-[12px] font-black text-white"
              >
                다시 복사
              </button>
            </div>
          )}
        </div>

        {completedSessions.length > 0 && (
          <section className="mt-7">
            <p className="px-1 text-[20px] font-black tracking-[-0.04em] text-[#111827]">완료한 레벨</p>
            <div className="mt-3 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
              {completedSessions.map((session) => {
                const sessionOwnerName = (session.ownerName || readStoredBalanceOwnerName(session.level, normalizeBalanceQuestionCount(session.questionCount))).trim();

                return (
                  <div
                    key={session.sessionId}
                    className="py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[22px] font-black tracking-[-0.05em] text-black">Lv.{session.level} · {session.questionCount}문항 완료</p>
                        {sessionOwnerName && (
                          <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-[#F0FFF7] px-2.5 py-1 text-[11px] font-black text-[#12863C]">
                            <span className="truncate">{sessionOwnerName}님</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openCompletedResult(session)}
                          className="text-[13px] font-black text-[#111827] underline decoration-[#20D879] decoration-2 underline-offset-4"
                        >
                          결과 보기
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteCompletedSession(session)}
                          disabled={isSaving}
                          className="text-[13px] font-black text-[#EF4444] disabled:opacity-40"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleKakaoPredictionShare(session.sessionId, session.level, session.questionCount)}
                        disabled={isSaving}
                        className="flex h-[48px] items-center justify-center gap-1.5 rounded-xl bg-[#FEE500] text-[13px] font-black text-[#191919] disabled:opacity-50"
                      >
                        <KakaoBubbleIcon />
                        카카오 공유
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyPredictionLink(session.sessionId, session.level, session.questionCount)}
                        disabled={isSaving}
                        className="flex h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-black text-[#20D879] disabled:opacity-50"
                      >
                        링크 복사
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-auto pt-8 text-[12px] leading-5 text-[#9CA3AF] break-keep">
          아무것도 고르지 않고 나가면 진행 상태를 남기지 않습니다. 다른 레벨은 난이도 선택에서 바로 시작할 수 있어요.
        </div>
      </div>
    </main>
  );
}
