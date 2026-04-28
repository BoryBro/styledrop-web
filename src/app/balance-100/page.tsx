"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useLabFeatureAvailability } from "@/hooks/useLabFeatureAvailability";
import { trackClientEvent } from "@/lib/client-events";
import { BALANCE_100_LAB_ENABLED } from "@/lib/feature-flags";
import {
  BALANCE_DIMENSION_LABELS,
  BALANCE_LEVELS,
  BALANCE_TOTAL_QUESTIONS,
  analyzeBalanceAnswers,
  encodeBalanceSharePayload,
  getBalance100Progress,
  getBalanceQuestions,
  getFirstUnansweredIndex,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceDimension,
  type BalanceLevel,
  type BalanceResultSummary,
  type BalanceSharePayload,
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
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-bold">
        <span className="text-[#111827]">{label}</span>
        <span className="tabular-nums text-[#20D879]">{value}</span>
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
}: {
  result: BalanceResultSummary;
  representativeImageUrl?: string;
  matches: BalanceMatchItem[];
}) {
  const sortedScores = [...SCORE_ORDER].sort((a, b) => result.scores[b] - result.scores[a]);
  const topDimension = sortedScores[0];

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[32px] border border-[#E9E9E9] bg-white shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
        {representativeImageUrl && (
          <div className="aspect-[4/3] w-full overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={representativeImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">
            Balance 100
          </p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.12] tracking-[-0.05em] text-black">
            {result.typeTitle}
          </h1>
          <p className="mt-4 break-keep text-[16px] font-medium leading-8 text-[#555]">
            {result.typeDesc}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] bg-[#F5FFF9] p-4">
              <p className="text-[12px] font-bold text-[#777]">답변 완료</p>
              <p className="mt-1 text-[25px] font-black text-black">{result.answeredCount}/100</p>
            </div>
            <div className="rounded-[24px] bg-[#F5FFF9] p-4">
              <p className="text-[12px] font-bold text-[#777]">선택 코드</p>
              <p className="mt-1 text-[25px] font-black tracking-[-0.04em] text-black">{result.matchCode}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#E9E9E9] bg-white p-6">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">Main Signal</p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">
          가장 강한 기준은 {BALANCE_DIMENSION_LABELS[topDimension]}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#6B7280] break-keep">
          점수가 높은 영역일수록 선택에서 더 자주 튀어나온 기준입니다.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {SCORE_ORDER.map((dimension) => (
            <ScoreBar key={dimension} label={BALANCE_DIMENSION_LABELS[dimension]} value={result.scores[dimension]} />
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#E9E9E9] bg-white p-6">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">Pick Review</p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">흔들림 컸던 선택 TOP 5</h2>
        <div className="mt-4 flex flex-col gap-3">
          {result.topChoices.map((choice, index) => (
            <div key={choice.id} className="rounded-[24px] bg-[#F7F7F7] p-4">
              <p className="text-[11px] font-black text-[#20D879]">#{index + 1} · {choice.picked}</p>
              <p className="mt-1 text-[15px] font-bold leading-6 text-[#111827] break-keep">{choice.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#CFF7DF] bg-[#F0FFF7] p-6">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">Matching</p>
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
  const { user, loading, login } = useAuth();
  const {
    isLoading: isAvailabilityLoading,
    isVisible: isLabVisible,
    isEnabled: isLabEnabled,
  } = useLabFeatureAvailability(BALANCE_100_CONTROL_ID, BALANCE_100_LAB_ENABLED);
  const [mode, setMode] = useState<Mode>("intro");
  const [serverSession, setServerSession] = useState<BalanceServerSession | null>(null);
  const [matches, setMatches] = useState<BalanceMatchItem[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<BalanceLevel>(3);
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
    () => serverSession?.result ?? (isCompleted ? analyzeBalanceAnswers(answers, questions) : null),
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
    setMode(nextSession.status === "completed" ? "result" : "intro");
  }, []);

  useEffect(() => {
    if (!user) return;

    fetch("/api/balance-100/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok) applySession(data.session ?? null, data.matches ?? []);
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

    const completed = Object.keys(nextAnswers).length >= questions.length;
    setIsSaving(true);

    saveSession(serverSession.sessionId, nextAnswers, representativeImageUrl)
      .then((saved) => {
        if (saved.status === "completed") {
          setMode("result");
          void trackClientEvent("lab_balance_completed", { level: saved.level });
        }
      })
      .catch(() => setShareStatus("답변 저장에 실패했어요. 다시 눌러주세요."))
      .finally(() => setIsSaving(false));
  }, [answers, isSaving, question, questions.length, representativeImageUrl, saveSession, serverSession]);

  const selectRepresentativeImage = useCallback((imageUrl: string) => {
    setRepresentativeImageUrl(imageUrl);
    if (!serverSession) return;
    setIsSaving(true);
    saveSession(serverSession.sessionId, answers, imageUrl)
      .catch(() => setShareStatus("대표 이미지 저장에 실패했어요."))
      .finally(() => setIsSaving(false));
  }, [answers, saveSession, serverSession]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const payload: BalanceSharePayload = {
      version: 1,
      level: selectedLevel,
      typeTitle: result.typeTitle,
      typeDesc: result.typeDesc,
      scores: result.scores,
      matchCode: result.matchCode,
      completedAt: serverSession?.completedAt ?? new Date().toISOString(),
      representativeImageUrl,
      topChoices: result.topChoices,
    };
    const encoded = encodeBalanceSharePayload(payload);
    const shareUrl = `${window.location.origin}/balance-100/share?data=${encodeURIComponent(encoded)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "밸런스 100 결과",
          text: `나는 ${result.typeTitle}. 너는 몇 개나 같을까?`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("결과 링크가 복사됐어요.");
      }
      void trackClientEvent("lab_balance_share_link_copy", { match_code: result.matchCode });
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("결과 링크가 복사됐어요.");
      } catch {
        setShareStatus("링크 복사에 실패했어요.");
      }
    }
  }, [representativeImageUrl, result, selectedLevel, serverSession?.completedAt]);

  const handlePredictionShare = useCallback(async () => {
    if (!serverSession) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/balance-100/session/${encodeURIComponent(serverSession.sessionId)}/prediction-link`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data?.path) throw new Error(data?.error ?? "failed");
      const shareUrl = `${window.location.origin}${data.path}`;

      if (navigator.share) {
        await navigator.share({
          title: "밸런스 100 예측하기",
          text: "내가 어떻게 골랐을 것 같아? 100문항으로 맞혀봐.",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("예측 링크가 복사됐어요.");
      }
    } catch {
      try {
        if (serverSession) {
          const fallback = `${window.location.origin}/balance-100`;
          await navigator.clipboard.writeText(fallback);
        }
        setShareStatus("링크 생성에 실패했어요.");
      } catch {
        setShareStatus("링크 생성에 실패했어요.");
      }
    } finally {
      setIsSaving(false);
    }
  }, [serverSession]);

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
      <main className="min-h-screen bg-white px-6 py-6">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/studio" className="text-[38px] font-light leading-none text-black">‹</Link>
            <button type="button" onClick={resetQuiz} className="text-[14px] font-black text-[#20D879]">새로 시작</button>
          </div>

          <ResultReport result={result} representativeImageUrl={representativeImageUrl} matches={matches} />

          <section className="mt-4 rounded-[30px] border border-[#E9E9E9] bg-white p-6">
            <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">StyleDrop Image</p>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.05em] text-[#111827]">대표 이미지 선택</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#6B7280] break-keep">
              스타일드롭에서 만든 이미지 기록 중에서만 고릅니다.
            </p>
            {historyImages.length === 0 ? (
              <Link href="/studio" className="mt-4 block rounded-[26px] px-4 py-4 text-center text-[15px] font-black text-white" style={{ backgroundColor: GREEN }}>
                스타일드롭 이미지 만들러 가기
              </Link>
            ) : (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {historyImages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectRepresentativeImage(item.result_image_url)}
                    className={`aspect-square overflow-hidden rounded-[22px] border-2 bg-[#F3F4F6] ${
                      representativeImageUrl === item.result_image_url ? "border-[#20D879]" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.result_image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="sticky bottom-0 -mx-6 mt-4 grid gap-2 bg-white/92 px-6 pb-5 pt-3 backdrop-blur">
            <button
              type="button"
              onClick={handlePredictionShare}
              disabled={isSaving}
              className="h-[62px] w-full rounded-[34px] bg-black text-[17px] font-black text-white disabled:opacity-50"
            >
              내가 고른 답 맞혀보기 링크
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="h-[62px] w-full rounded-[34px] text-[17px] font-black text-white shadow-[0_16px_30px_rgba(32,216,121,0.22)]"
              style={{ backgroundColor: GREEN }}
            >
              결과만 공유하기
            </button>
            {shareStatus && <p className="mt-1 text-center text-[12px] font-bold text-[#20D879]">{shareStatus}</p>}
          </div>
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
          <TopProgress progressRatio={progressRatio} onBack={() => setMode("intro")} />

          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">
            {currentIndex + 1} / {questions.length} · Level {selectedLevel}
          </p>
          <h1 className="mt-5 break-keep text-[34px] font-black leading-[1.23] tracking-[-0.06em] text-black">
            둘 중 하나만
            <br />
            골라봐요 :)
          </h1>
          <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-[#9A9A9A]">
            선택하면 바로 저장되고, 다음 버튼으로 넘길 수 있어요.
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
                  if (isCompleted) setMode("result");
                  return;
                }
                setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
              }}
            >
              {currentIndex >= questions.length - 1 ? "결과 보기" : "다음"}
            </PrimaryButton>
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

  const activeLevel = BALANCE_LEVELS.find((item) => item.level === selectedLevel) ?? BALANCE_LEVELS[2];

  return (
    <main className="min-h-screen bg-white px-6 py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col">
        <TopProgress progressRatio={Math.round((progress.answered / 100) * 100)} backHref="/studio" />

        <section>
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">{activeLevel.badge}</p>
          <h1 className="mt-5 text-[44px] font-black leading-[1.08] tracking-[-0.07em] text-black">
            밸런스 100
          </h1>
          <p className="mt-5 break-keep text-[17px] font-medium leading-8 text-[#555]">
            100개의 선택을 고르면 내 기준이 저장되고, 친구가 내 답을 얼마나 맞히는지도 확인할 수 있어요.
          </p>
          <div className="mt-6 rounded-[28px] border border-[#D9F7E5] bg-[#F0FFF7] p-5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-black text-black">{activeLevel.title}</span>
              <span className="text-[18px] font-black tabular-nums text-black">{progress.answered} / 100</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full" style={{ width: `${progress.answered}%`, backgroundColor: GREEN }} />
            </div>
          </div>
        </section>

        {progress.answered === 0 && !serverSession && (
          <section className="mt-5">
            <p className="px-1 text-[13px] font-black text-[#111827]">난이도 선택</p>
            <div className="mt-3 grid gap-3">
              {BALANCE_LEVELS.map((level) => (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => setSelectedLevel(level.level)}
                  className={`rounded-[26px] border px-5 py-4 text-left transition ${
                    selectedLevel === level.level
                      ? "border-[#20D879] bg-[#F0FFF7]"
                      : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-black text-[#111827]">Lv.{level.level} {level.title}</p>
                    <span className="text-[10px] font-black text-[#20D879]">{level.badge}</span>
                  </div>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-[#6B7280] break-keep">{level.description}</p>
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

        <div className="mt-auto pt-8 text-[12px] leading-5 text-[#9CA3AF] break-keep">
          진행 중이면 자동으로 이어서 열립니다. 새 문제 세트는 새로 시작하기를 눌렀을 때만 만들어집니다.
        </div>
      </div>
    </main>
  );
}
