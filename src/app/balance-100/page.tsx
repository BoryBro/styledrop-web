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

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-bold">
        <span className="text-[#111827]">{label}</span>
        <span className="tabular-nums text-[#E11D48]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F1F4]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#111827,#E11D48)] transition-all duration-700"
          style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
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
      <section className="overflow-hidden rounded-[32px] bg-[#111827] text-white shadow-[0_22px_44px_rgba(17,24,39,0.20)]">
        {representativeImageUrl && (
          <div className="aspect-[4/3] w-full overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={representativeImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#FB7185]">
            Balance 100 Completed
          </p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.05] tracking-[-0.06em]">
            {result.typeTitle}
          </h1>
          <p className="mt-4 text-[15px] font-medium leading-7 text-white/72 break-keep">
            {result.typeDesc}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-[11px] font-bold text-white/45">답변 완료</p>
              <p className="mt-1 text-[24px] font-black">{result.answeredCount}/100</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-[11px] font-bold text-white/45">선택 코드</p>
              <p className="mt-1 text-[24px] font-black tracking-[-0.04em]">{result.matchCode}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#ECECF1] bg-white p-5">
        <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">Main Signal</p>
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

      <section className="rounded-[28px] border border-[#ECECF1] bg-white p-5">
        <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">Extreme Picks</p>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">흔들림 컸던 선택 TOP 5</h2>
        <div className="mt-4 flex flex-col gap-3">
          {result.topChoices.map((choice, index) => (
            <div key={choice.id} className="rounded-2xl bg-[#F8F8FA] p-4">
              <p className="text-[11px] font-black text-[#E11D48]">#{index + 1} · {choice.picked}</p>
              <p className="mt-1 text-[15px] font-bold leading-6 text-[#111827] break-keep">{choice.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#FFE4E6] bg-[#FFF1F2] p-5">
        <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">Matching</p>
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
              <div key={match.sessionId} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <div>
                  <p className="text-[12px] font-black text-[#E11D48]">TOP {index + 1}</p>
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

    const nextIndex = questions.findIndex((item, index) => index > currentIndex && !nextAnswers[item.id]);
    const completed = Object.keys(nextAnswers).length >= questions.length;
    setCurrentIndex(completed ? currentIndex : nextIndex >= 0 ? nextIndex : getFirstUnansweredIndex(nextAnswers, questions));
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
  }, [answers, currentIndex, isSaving, question, questions, representativeImageUrl, saveSession, serverSession]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFB] px-5">
        <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#E11D48]" style={{ animation: "spin 1s linear infinite" }} />
      </main>
    );
  }

  if (!isLabVisible || !isLabEnabled) {
    return (
      <main className="min-h-screen bg-[#0F1117] px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[13px] font-bold text-white/50">← 실험실로 돌아가기</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#FB7185]">Balance Lab</p>
          <h1 className="mt-4 text-[42px] font-black leading-[0.95] tracking-[-0.07em]">
            지금은 잠시
            <br />
            점검 중이에요
          </h1>
          <p className="mt-5 text-[16px] font-medium leading-7 text-white/68 break-keep">
            어드민에서 현재 실험실 진입을 중지한 상태입니다. 잠시 후 다시 확인해주세요.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0F1117] px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[13px] font-bold text-white/50">← 실험실로 돌아가기</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#FB7185]">Balance Lab</p>
          <h1 className="mt-4 text-[42px] font-black leading-[0.95] tracking-[-0.07em]">
            밸런스 100
          </h1>
          <p className="mt-5 text-[16px] font-medium leading-7 text-white/68 break-keep">
            100개의 선택을 저장하고, 나와 비슷한 사람을 찾는 실험실 카드입니다. 로그인 후 이용할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => login("/balance-100")}
            className="mt-8 h-14 rounded-full bg-[#FEE500] text-[16px] font-black text-[#191919]"
          >
            카카오로 시작하기
          </button>
        </div>
      </main>
    );
  }

  if (mode === "result" && result) {
    return (
      <main className="min-h-screen bg-[#FAFAFB] px-5 py-6">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex items-center justify-between">
            <Link href="/studio" className="text-[13px] font-bold text-[#6B7280]">← 실험실</Link>
            <button type="button" onClick={resetQuiz} className="text-[13px] font-bold text-[#E11D48]">새로 시작하기</button>
          </div>

          <ResultReport result={result} representativeImageUrl={representativeImageUrl} matches={matches} />

          <section className="mt-4 rounded-[28px] border border-[#ECECF1] bg-white p-5">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">StyleDrop Image</p>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.05em] text-[#111827]">대표 이미지 선택</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#6B7280] break-keep">
              스타일드롭에서 만든 이미지 기록 중에서만 고릅니다.
            </p>
            {historyImages.length === 0 ? (
              <Link href="/studio" className="mt-4 block rounded-2xl bg-[#111827] px-4 py-4 text-center text-[14px] font-black text-white">
                스타일드롭 이미지 만들러 가기
              </Link>
            ) : (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {historyImages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectRepresentativeImage(item.result_image_url)}
                    className={`aspect-square overflow-hidden rounded-2xl border-2 bg-[#F3F4F6] ${
                      representativeImageUrl === item.result_image_url ? "border-[#E11D48]" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.result_image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="sticky bottom-0 -mx-5 mt-4 grid gap-2 bg-[#FAFAFB]/92 px-5 pb-5 pt-3 backdrop-blur">
            <button
              type="button"
              onClick={handlePredictionShare}
              disabled={isSaving}
              className="h-14 w-full rounded-full bg-[#111827] text-[16px] font-black text-white disabled:opacity-50"
            >
              내가 고른 답 맞혀보기 링크
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="h-14 w-full rounded-full bg-[#E11D48] text-[16px] font-black text-white shadow-[0_16px_30px_rgba(225,29,72,0.28)]"
            >
              결과만 공유하기
            </button>
            {shareStatus && <p className="mt-1 text-center text-[12px] font-bold text-[#E11D48]">{shareStatus}</p>}
          </div>
        </div>
      </main>
    );
  }

  if (mode === "quiz" && question) {
    const answeredValue = answers[question.id];
    const progressRatio = Math.round((progress.answered / questions.length) * 100);

    return (
      <main className="min-h-screen bg-[#0F1117] px-5 py-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMode("intro")}
              className="text-[13px] font-bold text-white/48"
            >
              나가기
            </button>
            <span className="text-[13px] font-black tabular-nums text-white/68">
              {progress.answered} / {questions.length}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#FB7185]" style={{ width: `${progressRatio}%` }} />
          </div>
          <p className="mt-3 text-[12px] font-bold text-white/38">
            레벨 {selectedLevel} · 답할 때마다 서버에 자동 저장됩니다.
          </p>

          <div className="flex flex-1 flex-col justify-center py-8">
            <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#FB7185]">
              Question {currentIndex + 1}
            </p>
            <h1 className="mt-4 text-[28px] font-black leading-[1.12] tracking-[-0.06em] break-keep">
              둘 중 하나만 골라야 한다면?
            </h1>

            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={() => pickAnswer("A")}
                disabled={isSaving}
                className={`rounded-[28px] border p-5 text-left transition disabled:opacity-70 ${
                  answeredValue === "A" ? "border-[#FB7185] bg-[#FB7185]/18" : "border-white/10 bg-white/[0.06]"
                }`}
              >
                <p className="text-[12px] font-black text-[#FB7185]">A</p>
                <p className="mt-2 text-[19px] font-black leading-7 break-keep">{question.left}</p>
              </button>
              <button
                type="button"
                onClick={() => pickAnswer("B")}
                disabled={isSaving}
                className={`rounded-[28px] border p-5 text-left transition disabled:opacity-70 ${
                  answeredValue === "B" ? "border-[#FB7185] bg-[#FB7185]/18" : "border-white/10 bg-white/[0.06]"
                }`}
              >
                <p className="text-[12px] font-black text-[#FB7185]">B</p>
                <p className="mt-2 text-[19px] font-black leading-7 break-keep">{question.right}</p>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="h-[52px] flex-1 rounded-full border border-white/10 text-[14px] font-black text-white/60 disabled:opacity-30"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex >= questions.length - 1}
              className="h-[52px] flex-1 rounded-full bg-white text-[14px] font-black text-[#111827] disabled:opacity-30"
            >
              다음 문항
            </button>
          </div>
        </div>
      </main>
    );
  }

  const activeLevel = BALANCE_LEVELS.find((item) => item.level === selectedLevel) ?? BALANCE_LEVELS[2];

  return (
    <main className="min-h-screen bg-[#FAFAFB] px-5 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <Link href="/studio" className="mb-8 text-[13px] font-bold text-[#6B7280]">← 실험실로 돌아가기</Link>

        <section className="rounded-[34px] bg-[#111827] p-6 text-white shadow-[0_24px_48px_rgba(17,24,39,0.22)]">
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#FB7185]">Balance Lab</p>
          <h1 className="mt-4 text-[44px] font-black leading-[0.95] tracking-[-0.08em]">
            밸런스<br />100
          </h1>
          <p className="mt-5 text-[15px] font-medium leading-7 text-white/68 break-keep">
            100개의 선택을 끝내면 내 기준이 저장되고, 같은 레벨을 완료한 사람과 일치율을 비교합니다.
          </p>
          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-white/48">{activeLevel.title}</span>
              <span className="text-[18px] font-black tabular-nums">{progress.answered} / 100</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#FB7185]" style={{ width: `${progress.answered}%` }} />
            </div>
          </div>
        </section>

        {progress.answered === 0 && !serverSession && (
          <section className="mt-5">
            <p className="px-1 text-[13px] font-black text-[#111827]">난이도 선택</p>
            <div className="mt-2 grid gap-2">
              {BALANCE_LEVELS.map((level) => (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => setSelectedLevel(level.level)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    selectedLevel === level.level
                      ? "border-[#E11D48] bg-[#FFF1F2]"
                      : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-black text-[#111827]">Lv.{level.level} {level.title}</p>
                    <span className="text-[10px] font-black text-[#E11D48]">{level.badge}</span>
                  </div>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-[#6B7280] break-keep">{level.description}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={startQuiz}
            disabled={isSaving}
            className="h-[60px] rounded-full bg-[#E11D48] text-[16px] font-black text-white shadow-[0_16px_30px_rgba(225,29,72,0.26)] disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : progress.answered > 0 ? "이어하기" : "시작하기"}
          </button>
          {progress.answered > 0 && (
            <button
              type="button"
              onClick={resetQuiz}
              disabled={isSaving}
              className="h-[52px] rounded-full border border-[#E5E7EB] bg-white text-[14px] font-black text-[#6B7280] disabled:opacity-50"
            >
              새로 시작하기
            </button>
          )}
          {isCompleted && (
            <button
              type="button"
              onClick={() => setMode("result")}
              className="h-[52px] rounded-full border border-[#FBCFE8] bg-[#FFF1F2] text-[14px] font-black text-[#E11D48]"
            >
              결과 다시 보기
            </button>
          )}
          {shareStatus && <p className="text-center text-[12px] font-bold text-[#E11D48]">{shareStatus}</p>}
        </div>

        <div className="mt-auto pt-8 text-[12px] leading-5 text-[#9CA3AF] break-keep">
          진행 중이면 자동으로 이어서 열립니다. 새 문제 세트는 새로 시작하기를 눌렀을 때만 만들어집니다.
        </div>
      </div>
    </main>
  );
}
