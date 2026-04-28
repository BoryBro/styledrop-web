"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useLabFeatureAvailability } from "@/hooks/useLabFeatureAvailability";
import { trackClientEvent } from "@/lib/client-events";
import { BALANCE_100_LAB_ENABLED } from "@/lib/feature-flags";
import {
  BALANCE_DIMENSION_LABELS,
  BALANCE_LEVELS,
  BALANCE_TOTAL_QUESTIONS,
  analyzeBalanceAnswers,
  getBalance100Progress,
  getBalanceQuestions,
  getFirstUnansweredIndex,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceDimension,
  type BalanceLevel,
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
  matchedCount: number;
  percent: number;
  typeTitle: string;
};

type HistoryImage = {
  id: string;
  style_id: string;
  result_image_url: string;
  created_at: string;
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

const SCORE_ORDER: BalanceDimension[] = ["money", "love", "social", "pride", "risk", "comfort"];
const GREEN = "#20D879";

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

function BalanceIntroHeader() {
  return (
    <header className="sticky top-0 z-40 -mx-6 flex h-14 items-center justify-between border-b border-gray-100 bg-white/90 px-5 backdrop-blur">
      <Link href="/studio" className="flex items-center gap-1.5 text-gray-400 transition-colors hover:text-gray-900">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[14px] font-semibold">돌아가기</span>
      </Link>
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
      <p className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#20D879]">선택 기준 분석</p>
      <h1 className="text-[34px] font-black leading-[1.12] tracking-[-0.06em] text-gray-900">밸런스 100</h1>
      <p className="mt-5 break-keep text-[16px] font-bold leading-7 text-gray-500">
        100개 선택으로 내 기준을 저장하고
        <br />
        <span className="text-[#12863C]">친구가 내 답을 맞혀보게 해요</span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["난이도 5단계", "결과 저장", "친구 맞히기"].map((tag) => (
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

function ScoreBar({ label, value }: { label: string; value: number }) {
  const strength = value >= 68 ? "강함" : value >= 55 ? "자주 나옴" : "보통";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-bold">
        <span className="text-[#111827]">{label}</span>
        <span className="text-[#20D879]">{strength}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F1F4]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(8, Math.min(100, value))}%`, backgroundColor: GREEN }}
        />
      </div>
    </div>
  );
}

function ResultReport({
  result,
  representativeImageUrl,
  matches,
  historyImages,
  onSelectRepresentativeImage,
}: {
  result: BalanceResultSummary;
  representativeImageUrl?: string;
  matches: BalanceMatchItem[];
  historyImages: HistoryImage[];
  onSelectRepresentativeImage: (imageUrl: string) => void;
}) {
  const sortedScores = [...SCORE_ORDER].sort((a, b) => result.scores[b] - result.scores[a]);
  const topDimension = sortedScores[0];
  const secondDimension = sortedScores[1];
  const bottomDimension = sortedScores[sortedScores.length - 1];
  const topScore = result.scores[topDimension];
  const secondScore = result.scores[secondDimension];
  const scoreSpread = topScore - result.scores[bottomDimension];
  const isBalanced = topScore - secondScore <= 4 && scoreSpread <= 12;
  const signalTitle = isBalanced
    ? "선택 기준이 고르게 나뉘었어요"
    : `가장 자주 드러난 기준은 ${BALANCE_DIMENSION_LABELS[topDimension]}`;
  const signalDescription = isBalanced
    ? "한 가지 기준으로 몰리기보다 상황마다 판단 기준을 바꾼 편입니다."
    : `${BALANCE_DIMENSION_LABELS[topDimension]} 쪽 점수가 가장 높게 나왔어요. 비슷한 선택지에서 이 기준을 더 자주 우선했습니다.`;
  const headline = result.resultHeadline ?? result.typeTitle;
  const reason = result.resultReason ?? result.typeDesc;
  const evidenceChoices = result.evidenceChoices ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[32px] border border-[#E9E9E9] bg-white shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
        {representativeImageUrl && (
          <div className="relative aspect-square w-full overflow-hidden bg-[#F4F5F4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={representativeImageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={representativeImageUrl} alt="" className="relative z-10 h-full w-full object-contain" />
          </div>
        )}
        {historyImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-[#F2F2F2] px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {historyImages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectRepresentativeImage(item.result_image_url)}
                className={`h-12 w-12 shrink-0 overflow-hidden rounded-[16px] border-2 bg-[#F3F4F6] ${
                  representativeImageUrl === item.result_image_url ? "border-[#20D879]" : "border-transparent"
                }`}
                aria-label="대표 이미지 선택"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.result_image_url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="p-6">
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">
            Balance 100
          </p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.12] tracking-[-0.05em] text-black">
            {headline}
          </h1>
          {headline !== result.typeTitle && (
            <p className="mt-3 inline-flex rounded-full bg-[#F0FFF7] px-3 py-1 text-[12px] font-black text-[#20D879]">
              {result.typeTitle}
            </p>
          )}
          <p className="mt-4 break-keep text-[16px] font-bold leading-8 text-[#555]">
            {reason}
          </p>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#E9E9E9] bg-white p-6">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">근거</p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">왜 이렇게 나왔나</h2>
        <p className="mt-2 break-keep text-[14px] leading-6 text-[#6B7280]">
          실제로 고른 답 중 결과에 크게 반영된 선택입니다.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {evidenceChoices.length > 0 ? (
            evidenceChoices.slice(0, 4).map((choice) => (
              <div key={choice.id} className="rounded-[24px] bg-[#F7F8F7] p-4">
                <p className="text-[11px] font-black text-[#20D879]">{choice.label}</p>
                <p className="mt-1 break-keep text-[17px] font-black leading-6 text-[#111827]">{choice.text}</p>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-[#6B7280]">{choice.reason}</p>
              </div>
            ))
          ) : (
            result.topChoices.slice(0, 4).map((choice) => (
              <div key={choice.id} className="rounded-[24px] bg-[#F7F8F7] p-4">
                <p className="text-[11px] font-black text-[#20D879]">선택 근거</p>
                <p className="mt-1 break-keep text-[17px] font-black leading-6 text-[#111827]">{choice.text}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#E9E9E9] bg-white p-6">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">기준 요약</p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">
          {signalTitle}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#6B7280] break-keep">
          {signalDescription}
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {SCORE_ORDER.map((dimension) => (
            <ScoreBar key={dimension} label={BALANCE_DIMENSION_LABELS[dimension]} value={result.scores[dimension]} />
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#CFF7DF] bg-[#F0FFF7] p-6">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">비슷한 사람</p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">
          나와 비슷한 선택자
        </h2>
        {matches.length === 0 ? (
          <p className="mt-2 text-[14px] leading-6 text-[#6B7280] break-keep">
            아직 같은 레벨을 완료한 비교 대상이 부족합니다. 친구에게 예측 링크를 보내면 데이터가 쌓입니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {matches.map((match, index) => (
              <div key={match.sessionId} className="flex items-center justify-between rounded-[22px] bg-white px-4 py-3">
                <div>
                  <p className="text-[12px] font-black text-[#20D879]">TOP {index + 1}</p>
                  <p className="mt-0.5 text-[14px] font-black text-[#111827]">{match.ownerName}</p>
                  <p className="text-[11px] font-bold text-[#9CA3AF]">{match.typeTitle}</p>
                </div>
                <p className="text-[20px] font-black text-[#111827]">{match.matchedCount}/100</p>
              </div>
            ))}
          </div>
        )}
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
  const [answers, setAnswers] = useState<BalanceAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [historyImages, setHistoryImages] = useState<HistoryImage[]>([]);
  const [representativeImageUrl, setRepresentativeImageUrl] = useState<string | undefined>();
  const [shareStatus, setShareStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const questions = useMemo(() => getBalanceQuestions(selectedLevel), [selectedLevel]);
  const progress = useMemo(() => getBalance100Progress(answers, questions), [answers, questions]);
  const isCompleted = progress.answered >= questions.length;
  const result = useMemo(
    () => {
      if (serverSession?.result) {
        return serverSession.result.evidenceChoices?.length
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

  const applySession = useCallback((nextSession: BalanceServerSession | null, nextMatches: BalanceMatchItem[] = []) => {
    setServerSession(nextSession);
    setMatches(nextMatches);
    if (!nextSession) {
      setAnswers({});
      setRepresentativeImageUrl(undefined);
      setCurrentIndex(0);
      setMode("intro");
      return;
    }

    const level = normalizeBalanceLevel(nextSession.level);
    const sessionAnswers = nextSession.answers ?? {};
    const sessionQuestions = getBalanceQuestions(level);
    setSelectedLevel(level);
    setAnswers(sessionAnswers);
    setRepresentativeImageUrl(nextSession.representativeImageUrl);
    setCurrentIndex(getFirstUnansweredIndex(sessionAnswers, sessionQuestions));
    setMode("intro");
  }, []);

  const upsertCompletedSession = useCallback((session: BalanceServerSession | null) => {
    if (!session?.result) return;
    setCompletedSessions((prev) => {
      const next = [
        session,
        ...prev.filter((item) => item.level !== session.level && item.sessionId !== session.sessionId),
      ];
      return next.sort((a, b) => a.level - b.level);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    fetch("/api/balance-100/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok) {
          setCompletedSessions(Array.isArray(data.completedSessions) ? data.completedSessions : []);
          applySession(data.session ?? null, data.matches ?? []);
        }
      })
      .catch(() => undefined);

    fetch("/api/history")
      .then((response) => response.json())
      .then((data) => {
        const history = Array.isArray(data?.history) ? data.history as HistoryImage[] : [];
        setHistoryImages(history.filter((item) => item.result_image_url).slice(0, 12));
      })
      .catch(() => setHistoryImages([]));
  }, [applySession, user]);

  const startQuiz = useCallback(async () => {
    setShareStatus("");
    if (serverSession) {
      setCurrentIndex(getFirstUnansweredIndex(answers, questions));
      setMode("quiz");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/balance-100/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedLevel }),
      });
      const data = await response.json();
      if (!response.ok || !data?.session) throw new Error(data?.error ?? "failed");
      applySession(data.session, data.matches ?? []);
      setMode("quiz");
      void trackClientEvent("lab_balance_started", { level: selectedLevel });
    } catch {
      setShareStatus("시작에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, applySession, questions, selectedLevel, serverSession]);

  const resetQuiz = useCallback(async () => {
    const ok = window.confirm("기존 진행 상태를 닫고 처음부터 다시 시작할까요?");
    if (!ok) return;

    setIsSaving(true);
    setShareStatus("");
    try {
      const response = await fetch("/api/balance-100/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedLevel, restart: true }),
      });
      const data = await response.json();
      if (!response.ok || !data?.session) throw new Error(data?.error ?? "failed");
      applySession(data.session, []);
      setMode("quiz");
      void trackClientEvent("lab_balance_started", { level: selectedLevel, restart: true });
    } catch {
      setShareStatus("새로 시작하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }, [applySession, selectedLevel]);

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
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.session) throw new Error(data?.error ?? "failed");
    const savedSession = data.session as BalanceServerSession;
    setServerSession(savedSession);
    setMatches(data.matches ?? []);
    setSelectedLevel(normalizeBalanceLevel(savedSession.level));
    setRepresentativeImageUrl(savedSession.representativeImageUrl);
    return data.session as BalanceServerSession;
  }, []);

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
      const saved = await saveSession(serverSession.sessionId, answers, representativeImageUrl);
      if (saved.status === "completed") {
        upsertCompletedSession(saved);
        void trackClientEvent("lab_balance_completed", { level: saved.level });
      }
      router.push("/studio");
    } catch {
      setShareStatus("저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, representativeImageUrl, router, saveSession, serverSession, upsertCompletedSession]);

  const handleFinishQuiz = useCallback(async () => {
    if (!serverSession || !isCompleted) return;

    setIsSaving(true);
    setShareStatus("");
    try {
      const saved = await saveSession(serverSession.sessionId, answers, representativeImageUrl);
      if (saved.status === "completed") {
        upsertCompletedSession(saved);
        void trackClientEvent("lab_balance_completed", { level: saved.level });
      }
      setMode("result");
    } catch {
      setShareStatus("결과 저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }, [answers, isCompleted, representativeImageUrl, saveSession, serverSession, upsertCompletedSession]);

  const selectRepresentativeImage = useCallback((imageUrl: string) => {
    setRepresentativeImageUrl(imageUrl);
    if (!serverSession) return;
    setIsSaving(true);
    saveSession(serverSession.sessionId, answers, imageUrl)
      .then((saved) => upsertCompletedSession(saved))
      .catch(() => setShareStatus("대표 이미지 저장에 실패했어요."))
      .finally(() => setIsSaving(false));
  }, [answers, saveSession, serverSession, upsertCompletedSession]);

  const openCompletedResult = useCallback((session: BalanceServerSession) => {
    setServerSession(session);
    setSelectedLevel(normalizeBalanceLevel(session.level));
    setAnswers(session.answers ?? {});
    setRepresentativeImageUrl(session.representativeImageUrl);
    setCurrentIndex(getFirstUnansweredIndex(session.answers ?? {}, getBalanceQuestions(session.level)));
    setMatches([]);
    setMode("result");
  }, []);

  const createPredictionShareUrl = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/balance-100/session/${encodeURIComponent(sessionId)}/prediction-link`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok || !data?.path) throw new Error(data?.error ?? "failed");
    if (data.session) upsertCompletedSession(data.session as BalanceServerSession);
    return `${window.location.origin}${data.path}`;
  }, [upsertCompletedSession]);

  const handleKakaoPredictionShare = useCallback(async (sessionId: string, level?: BalanceLevel) => {
    setIsSaving(true);
    setShareStatus("");
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
        text: `내가 밸런스 100에서 뭘 골랐을 것 같아?\n친구 입장에서 내 선택을 맞혀봐.`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      });
      setShareStatus(level ? `Lv.${level} 카카오 공유창을 열었어요.` : "카카오 공유창을 열었어요.");
    } catch {
      setShareStatus("카카오 공유에 실패했어요. 링크 복사를 이용해주세요.");
    } finally {
      window.setTimeout(() => setIsSaving(false), 1200);
    }
  }, [createPredictionShareUrl]);

  const handleCopyPredictionLink = useCallback(async (sessionId: string, level?: BalanceLevel) => {
    setIsSaving(true);
    setShareStatus("");
    try {
      const shareUrl = await createPredictionShareUrl(sessionId);
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus(level ? `Lv.${level} 친구 맞히기 링크가 복사됐어요.` : "친구 맞히기 링크가 복사됐어요.");
      void trackClientEvent("lab_balance_share_link_copy", { level });
    } catch {
      setShareStatus("링크 복사에 실패했어요.");
    } finally {
      setIsSaving(false);
    }
  }, [createPredictionShareUrl]);

  const handlePredictionShare = useCallback(async () => {
    if (!serverSession) return;
    await handleKakaoPredictionShare(serverSession.sessionId, serverSession.level);
  }, [handleKakaoPredictionShare, serverSession]);

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
            100개의 선택을 저장하고, 나와 비슷한 사람을 찾는 실험실 카드입니다. 로그인 후 이용할 수 있어요.
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
          <BalanceIntroHeader />

          <div className="pt-8">
            <ResultReport
              result={result}
              representativeImageUrl={representativeImageUrl}
              matches={matches}
              historyImages={historyImages}
              onSelectRepresentativeImage={selectRepresentativeImage}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePredictionShare}
              disabled={isSaving}
              className="flex h-[54px] items-center justify-center gap-1.5 rounded-[20px] bg-[#FEE500] text-[13px] font-black text-[#191919] disabled:opacity-50"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#191919] text-[10px] font-black text-[#FEE500]">K</span>
              카카오
            </button>
            <button
              type="button"
              onClick={() => serverSession && void handleCopyPredictionLink(serverSession.sessionId, serverSession.level)}
              disabled={isSaving || !serverSession}
              className="flex h-[54px] items-center justify-center rounded-[20px] border border-[#D9F7E5] bg-[#F0FFF7] text-[13px] font-black text-[#20D879] disabled:opacity-50"
            >
              🔗 Link
            </button>
          </div>
          {shareStatus && <p className="mt-3 text-center text-[12px] font-bold text-[#20D879]">{shareStatus}</p>}
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
            {currentIndex + 1} / {questions.length} · Level {selectedLevel}
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

        {progress.answered === 0 && !serverSession && (
          <section className="border-t border-gray-50 pt-7">
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

        <div className="mt-5 grid gap-3">
          <PrimaryButton onClick={startQuiz} disabled={isSaving}>
            {isSaving ? "저장 중..." : progress.answered > 0 ? "이어하기" : "시작하기"}
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
        </div>

        {completedSessions.length > 0 && (
          <section className="mt-7">
            <p className="px-1 text-[20px] font-black tracking-[-0.04em] text-[#111827]">완료한 레벨</p>
            <div className="mt-3 grid gap-3">
              {completedSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="rounded-[30px] border border-[#CFF7DF] bg-[#F0FFF7] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-[24px] font-black tracking-[-0.05em] text-black">Lv.{session.level} 완료</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2">
                    <button
                      type="button"
                      onClick={() => openCompletedResult(session)}
                      className="h-[56px] rounded-[28px] bg-[#111827] text-[15px] font-black text-white shadow-[0_14px_24px_rgba(17,24,39,0.14)]"
                    >
                      결과 보기
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleKakaoPredictionShare(session.sessionId, session.level)}
                        disabled={isSaving}
                        className="flex h-[50px] items-center justify-center gap-1.5 rounded-[26px] bg-[#FEE500] text-[13px] font-black text-[#191919] disabled:opacity-50"
                      >
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#191919] text-[10px] font-black text-[#FEE500]">K</span>
                        친구에게 물어보기
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyPredictionLink(session.sessionId, session.level)}
                        disabled={isSaving}
                        className="flex h-[50px] items-center justify-center gap-1.5 rounded-[26px] border border-[#CFF7DF] bg-white text-[13px] font-black text-[#20D879] disabled:opacity-50"
                      >
                        <span className="rounded-full bg-[#F0FFF7] px-2 py-1 text-[10px] font-black text-[#20D879]">🔗 Link</span>
                        친구에게 물어보기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-auto pt-8 text-[12px] leading-5 text-[#9CA3AF] break-keep">
          진행 중이면 자동으로 이어서 열립니다. 새 문제 세트는 새로 시작하기를 눌렀을 때만 만들어집니다.
        </div>
      </div>
    </main>
  );
}
