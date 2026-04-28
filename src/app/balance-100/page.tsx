"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useLabFeatureAvailability } from "@/hooks/useLabFeatureAvailability";
import { trackClientEvent } from "@/lib/client-events";
import { BALANCE_100_LAB_ENABLED } from "@/lib/feature-flags";
import {
  BALANCE_DIMENSION_LABELS,
  BALANCE_QUESTIONS,
  BALANCE_TOTAL_QUESTIONS,
  analyzeBalanceAnswers,
  encodeBalanceSharePayload,
  getBalance100Progress,
  getBalance100StorageKey,
  getFirstUnansweredIndex,
  type Balance100LocalState,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceDimension,
  type BalanceResultSummary,
  type BalanceSharePayload,
} from "@/lib/balance-100";
import { BALANCE_100_CONTROL_ID } from "@/lib/style-controls";

type Mode = "intro" | "quiz" | "result";

type HistoryImage = {
  id: string;
  style_id: string;
  result_image_url: string;
  created_at: string;
};

const SCORE_ORDER: BalanceDimension[] = ["money", "love", "social", "pride", "risk", "comfort"];

function safeParseState(raw: string | null): Balance100LocalState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Balance100LocalState;
    return parsed?.answers && typeof parsed.answers === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildStoredState(
  previous: Balance100LocalState | null,
  answers: BalanceAnswers,
  representativeImageUrl?: string,
): Balance100LocalState {
  const now = new Date().toISOString();
  const completed = Object.keys(answers).length >= BALANCE_TOTAL_QUESTIONS;
  const result = completed ? analyzeBalanceAnswers(answers) : undefined;

  return {
    answers,
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    completedAt: completed ? previous?.completedAt ?? now : undefined,
    result,
    representativeImageUrl: representativeImageUrl ?? previous?.representativeImageUrl,
  };
}

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
}: {
  result: BalanceResultSummary;
  representativeImageUrl?: string;
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
          점수가 높은 영역일수록 밸런스 선택에서 더 자주 튀어나온 기준입니다.
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
          100/100 같은 사람은 아직 찾는 중
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#6B7280] break-keep">
          지금은 친구에게 공유해서 결과를 보여주는 MVP입니다. 참여자가 쌓이면 같은 선택을 한 사람 TOP 5를 여기서 확인하는 구조로 확장합니다.
        </p>
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
  const [answers, setAnswers] = useState<BalanceAnswers>({});
  const [storedState, setStoredState] = useState<Balance100LocalState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [historyImages, setHistoryImages] = useState<HistoryImage[]>([]);
  const [representativeImageUrl, setRepresentativeImageUrl] = useState<string | undefined>();
  const [shareStatus, setShareStatus] = useState("");

  const progress = useMemo(() => getBalance100Progress(answers), [answers]);
  const isCompleted = progress.answered >= BALANCE_TOTAL_QUESTIONS;
  const result = useMemo(() => (isCompleted ? analyzeBalanceAnswers(answers) : null), [answers, isCompleted]);
  const question = BALANCE_QUESTIONS[currentIndex];

  const storageKey = user ? getBalance100StorageKey(user.id) : "";

  const persistState = useCallback((nextAnswers: BalanceAnswers, nextImageUrl?: string) => {
    if (!storageKey) return;
    const nextState = buildStoredState(storedState, nextAnswers, nextImageUrl ?? representativeImageUrl);
    setStoredState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }, [representativeImageUrl, storageKey, storedState]);

  useEffect(() => {
    if (!user) return;

    const parsed = safeParseState(window.localStorage.getItem(getBalance100StorageKey(user.id)));
    if (parsed) {
      setAnswers(parsed.answers);
      setStoredState(parsed);
      setRepresentativeImageUrl(parsed.representativeImageUrl);
      setCurrentIndex(getFirstUnansweredIndex(parsed.answers));
      if (parsed.completedAt || Object.keys(parsed.answers).length >= BALANCE_TOTAL_QUESTIONS) {
        setMode("result");
      }
    }

    fetch("/api/history")
      .then((response) => response.json())
      .then((data) => {
        const history = Array.isArray(data?.history) ? data.history as HistoryImage[] : [];
        setHistoryImages(history.filter((item) => item.result_image_url).slice(0, 12));
      })
      .catch(() => setHistoryImages([]));
  }, [user]);

  const startQuiz = useCallback(() => {
    if (progress.answered === 0) {
      void trackClientEvent("lab_balance_started");
    }
    setCurrentIndex(getFirstUnansweredIndex(answers));
    setMode("quiz");
  }, [answers, progress.answered]);

  const resetQuiz = useCallback(() => {
    if (!storageKey) return;
    const ok = window.confirm("답변을 처음부터 다시 시작할까요?");
    if (!ok) return;
    window.localStorage.removeItem(storageKey);
    setAnswers({});
    setStoredState(null);
    setRepresentativeImageUrl(undefined);
    setCurrentIndex(0);
    setMode("quiz");
    void trackClientEvent("lab_balance_started");
  }, [storageKey]);

  const pickAnswer = useCallback((value: BalanceAnswerValue) => {
    if (!question) return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);
    persistState(nextAnswers);

    if (Object.keys(nextAnswers).length >= BALANCE_TOTAL_QUESTIONS) {
      setMode("result");
      void trackClientEvent("lab_balance_completed");
      return;
    }

    const nextUnansweredAfterCurrent = BALANCE_QUESTIONS.findIndex((item, index) => index > currentIndex && !nextAnswers[item.id]);
    setCurrentIndex(nextUnansweredAfterCurrent >= 0 ? nextUnansweredAfterCurrent : getFirstUnansweredIndex(nextAnswers));
  }, [answers, currentIndex, persistState, question]);

  const selectRepresentativeImage = useCallback((imageUrl: string) => {
    setRepresentativeImageUrl(imageUrl);
    persistState(answers, imageUrl);
  }, [answers, persistState]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const payload: BalanceSharePayload = {
      version: 1,
      typeTitle: result.typeTitle,
      typeDesc: result.typeDesc,
      scores: result.scores,
      matchCode: result.matchCode,
      completedAt: storedState?.completedAt ?? new Date().toISOString(),
      representativeImageUrl,
      topChoices: result.topChoices,
    };
    const encoded = encodeBalanceSharePayload(payload);
    const shareUrl = `${window.location.origin}/balance-100/share?data=${encodeURIComponent(encoded)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "극악 밸런스 100 결과",
          text: `나는 ${result.typeTitle}. 너는 몇 개나 같을까?`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("공유 링크가 복사됐어요.");
      }
      void trackClientEvent("lab_balance_share_link_copy", { match_code: result.matchCode });
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("공유 링크가 복사됐어요.");
      } catch {
        setShareStatus("링크 복사에 실패했어요.");
      }
    }
  }, [representativeImageUrl, result, storedState?.completedAt]);

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
            극악 밸런스 100
          </h1>
          <p className="mt-5 text-[16px] font-medium leading-7 text-white/68 break-keep">
            100개의 선택을 저장하고, 나와 비슷한 사람을 계속 찾는 실험실 카드입니다. 로그인 후 이용할 수 있어요.
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
            <button type="button" onClick={resetQuiz} className="text-[13px] font-bold text-[#E11D48]">처음부터</button>
          </div>

          <ResultReport result={result} representativeImageUrl={representativeImageUrl} />

          <section className="mt-4 rounded-[28px] border border-[#ECECF1] bg-white p-5">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">StyleDrop Image</p>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.05em] text-[#111827]">대표 이미지 선택</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#6B7280] break-keep">
              외부 이미지는 쓰지 않고, 스타일드롭에서 만든 이미지 기록 중에서만 고릅니다.
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

          <div className="sticky bottom-0 -mx-5 mt-4 bg-[#FAFAFB]/92 px-5 pb-5 pt-3 backdrop-blur">
            <button
              type="button"
              onClick={handleShare}
              className="h-14 w-full rounded-full bg-[#E11D48] text-[16px] font-black text-white shadow-[0_16px_30px_rgba(225,29,72,0.28)]"
            >
              친구한테 공유하기
            </button>
            {shareStatus && <p className="mt-2 text-center text-[12px] font-bold text-[#E11D48]">{shareStatus}</p>}
          </div>
        </div>
      </main>
    );
  }

  if (mode === "quiz" && question) {
    const answeredValue = answers[question.id];
    const progressRatio = Math.round((progress.answered / BALANCE_TOTAL_QUESTIONS) * 100);

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
              {progress.answered} / {BALANCE_TOTAL_QUESTIONS}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#FB7185]" style={{ width: `${progressRatio}%` }} />
          </div>
          <p className="mt-3 text-[12px] font-bold text-white/38">답할 때마다 자동 저장됩니다.</p>

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
                className={`rounded-[28px] border p-5 text-left transition ${
                  answeredValue === "A" ? "border-[#FB7185] bg-[#FB7185]/18" : "border-white/10 bg-white/[0.06]"
                }`}
              >
                <p className="text-[12px] font-black text-[#FB7185]">A</p>
                <p className="mt-2 text-[19px] font-black leading-7 break-keep">{question.left}</p>
              </button>
              <button
                type="button"
                onClick={() => pickAnswer("B")}
                className={`rounded-[28px] border p-5 text-left transition ${
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
              onClick={() => setCurrentIndex((prev) => Math.min(BALANCE_TOTAL_QUESTIONS - 1, prev + 1))}
              disabled={currentIndex >= BALANCE_TOTAL_QUESTIONS - 1}
              className="h-[52px] flex-1 rounded-full bg-white text-[14px] font-black text-[#111827] disabled:opacity-30"
            >
              다음 문항
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAFB] px-5 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <Link href="/studio" className="mb-8 text-[13px] font-bold text-[#6B7280]">← 실험실로 돌아가기</Link>

        <section className="rounded-[34px] bg-[#111827] p-6 text-white shadow-[0_24px_48px_rgba(17,24,39,0.22)]">
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#FB7185]">Balance Lab</p>
          <h1 className="mt-4 text-[44px] font-black leading-[0.95] tracking-[-0.08em]">
            극악<br />밸런스 100
          </h1>
          <p className="mt-5 text-[15px] font-medium leading-7 text-white/68 break-keep">
            100개의 선택이 전부 같은 사람을 찾을 수 있을까? 중간에 나가도 이어서 할 수 있습니다.
          </p>
          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-white/48">진행률</span>
              <span className="text-[18px] font-black tabular-nums">{progress.answered} / 100</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#FB7185]" style={{ width: `${progress.answered}%` }} />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={startQuiz}
            className="h-[60px] rounded-full bg-[#E11D48] text-[16px] font-black text-white shadow-[0_16px_30px_rgba(225,29,72,0.26)]"
          >
            {progress.answered > 0 ? "이어하기" : "시작하기"}
          </button>
          {progress.answered > 0 && (
            <button
              type="button"
              onClick={resetQuiz}
              className="h-[52px] rounded-full border border-[#E5E7EB] bg-white text-[14px] font-black text-[#6B7280]"
            >
              처음부터 다시하기
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
        </div>

        <div className="mt-auto pt-8 text-[12px] leading-5 text-[#9CA3AF] break-keep">
          무료 실험실 카드입니다. 매칭 기능은 참여 데이터가 쌓이는 구조로 확장 예정이며, 현재 MVP에서는 결과 공유 흐름을 먼저 확인합니다.
        </div>
      </div>
    </main>
  );
}
