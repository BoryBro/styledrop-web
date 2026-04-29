"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  decodeBalanceSharePayload,
  getBalance100Progress,
  getBalanceQuestions,
  getBalanceResultStory,
  getFirstUnansweredIndex,
  normalizeBalanceQuestionCount,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceLevel,
  type BalanceQuestionCount,
  type BalanceSharePayload,
} from "@/lib/balance-100";

const GREEN = "#20D879";
const PENDING_PREDICTION_PREFIX = "styledrop_balance_100_pending_prediction:";

type PredictionInvite = {
  token: string;
  level: BalanceLevel;
  questionCount: BalanceQuestionCount;
  ownerName: string;
  total: number;
  isOwner: boolean;
};

type PredictionResult = {
  matchedCount: number;
  percent: number;
  tierTitle: string;
  tierDesc: string;
  reverseSharePath: string | null;
};

type PendingPrediction = {
  answers: BalanceAnswers;
  guestName: string;
};

function getPendingPredictionKey(token: string) {
  return `${PENDING_PREDICTION_PREFIX}${token}`;
}

function readPendingPrediction(token: string): PendingPrediction | null {
  try {
    const raw = sessionStorage.getItem(getPendingPredictionKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPrediction>;
    if (!parsed.answers || typeof parsed.guestName !== "string") return null;
    return {
      answers: parsed.answers as BalanceAnswers,
      guestName: parsed.guestName.trim().slice(0, 16),
    };
  } catch {
    return null;
  }
}

function writePendingPrediction(token: string, answers: BalanceAnswers, guestName: string) {
  try {
    sessionStorage.setItem(
      getPendingPredictionKey(token),
      JSON.stringify({
        answers,
        guestName: guestName.trim().slice(0, 16),
      }),
    );
  } catch {
    // 브라우저 저장소가 막혀도 서버 저장은 로그인 이후에만 시도합니다.
  }
}

function clearPendingPrediction(token: string) {
  try {
    sessionStorage.removeItem(getPendingPredictionKey(token));
  } catch {
    // ignore
  }
}

function TopProgress({
  progressRatio = 0,
  backHref = "/studio",
}: {
  progressRatio?: number;
  backHref?: string;
}) {
  return (
    <div className="flex items-center gap-4 pb-10 pt-3">
      <Link href={backHref} className="flex h-11 w-11 items-center justify-center text-[38px] font-light leading-none text-black" aria-label="뒤로가기">
        ‹
      </Link>
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
      className="h-[66px] w-full rounded-[34px] text-[18px] font-black text-white shadow-[0_16px_30px_rgba(32,216,121,0.22)] transition disabled:opacity-50"
      style={{ backgroundColor: GREEN }}
    >
      {children}
    </button>
  );
}

function ChoiceCard({
  label,
  value,
  disabled,
  onClick,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[86px] w-full items-center gap-4 rounded-[28px] border border-[#E9E9E9] bg-white px-6 py-5 text-left transition disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F7F7F7] text-[15px] font-black text-[#9A9A9A]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-keep text-[19px] font-bold leading-[1.45] text-[#2B2B2B]">
        {value}
      </span>
    </button>
  );
}

function SharedResultView({ payload }: { payload: BalanceSharePayload }) {
  const story = getBalanceResultStory(payload);
  const payloadQuestions = getBalanceQuestions(
    normalizeBalanceLevel(payload.level),
    normalizeBalanceQuestionCount(payload.questionCount),
  );
  const visibleChoices = payload.topChoices
    .map((choice, index) => ({
      choice,
      index,
      question: payloadQuestions.find((question) => question.id === choice.id),
    }))
    .filter((item) => item.question);

  return (
    <main className="min-h-screen bg-white px-6 py-4">
      <div className="mx-auto max-w-md">
        <TopProgress progressRatio={100} backHref="/balance-100" />
        <section className="border-b border-[#E5E7EB] pb-7">
          {payload.representativeImageUrl && (
            <div className="relative aspect-square w-full overflow-hidden bg-[#F4F5F4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payload.representativeImageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payload.representativeImageUrl} alt="" className="relative z-10 h-full w-full object-contain" />
            </div>
          )}
          <div className="pt-6">
            <p className="break-keep text-[19px] font-black leading-7 tracking-[-0.04em] text-[#111827]">
              친구님의 성향은 다음과 같아요!
            </p>
            <h1 className="mt-3 break-keep text-[32px] font-black leading-[1.14] tracking-[-0.06em] text-black">
              {story.verdictTitle} 같은 성향을 가지고 있어요!
            </h1>
            <p className="mt-4 break-keep text-[16px] font-bold leading-8 text-[#555]">
              {story.verdictSubtitle}
            </p>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[25px] font-black tracking-[-0.05em] text-[#111827]">밸런스 Q&A</h2>
          </div>
          <div className="-mx-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex snap-x snap-mandatory gap-3">
              {visibleChoices.map(({ choice, question, index }) => {
                if (!question) return null;
                const questionNumber = Number(question.id.split("_q")[1]) || index + 1;

                return (
                  <article key={choice.id} className="min-h-[168px] min-w-[72%] snap-start border border-[#E5E7EB] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#20D879]">
                        Q{String(questionNumber).padStart(2, "0")}
                      </p>
                      <p className="text-[12px] font-black text-[#111827]">선택 {choice.picked}</p>
                    </div>
                    <div className="mt-5 grid gap-3 text-[14px] font-bold leading-6 text-[#9CA3AF]">
                      <div className={`flex min-h-9 items-center justify-between gap-3 ${choice.picked === "A" ? "text-[#111827]" : ""}`}>
                        <span className="min-w-0 break-keep">A. {question.left}</span>
                        {choice.picked === "A" && payload.representativeImageUrl && (
                          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F3F4F6]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={payload.representativeImageUrl} alt="" className="h-full w-full object-cover" />
                          </span>
                        )}
                      </div>
                      <div className={`flex min-h-9 items-center justify-between gap-3 ${choice.picked === "B" ? "text-[#111827]" : ""}`}>
                        <span className="min-w-0 break-keep">B. {question.right}</span>
                        {choice.picked === "B" && payload.representativeImageUrl && (
                          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F3F4F6]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={payload.representativeImageUrl} alt="" className="h-full w-full object-cover" />
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

        <div className="sticky bottom-0 -mx-6 mt-4 bg-white/92 px-6 pb-5 pt-3 backdrop-blur">
          <Link
            href="/balance-100"
            className="flex h-[66px] w-full items-center justify-center rounded-[34px] text-[18px] font-black text-white shadow-[0_16px_30px_rgba(32,216,121,0.22)]"
            style={{ backgroundColor: GREEN }}
          >
            나도 해보기
          </Link>
        </div>
      </div>
    </main>
  );
}

function LoadingView() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5">
      <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#20D879]" style={{ animation: "spin 1s linear infinite" }} />
    </main>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-white px-6 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance Lab</p>
        <h1 className="mt-4 text-[36px] font-black leading-[1.15] tracking-[-0.06em] text-black">링크를 열 수 없어요.</h1>
        <p className="mt-3 break-keep text-[16px] font-medium leading-7 text-[#555]">{message}</p>
        <Link href="/balance-100" className="mt-8 flex h-[66px] items-center justify-center rounded-[34px] text-[17px] font-black text-white" style={{ backgroundColor: GREEN }}>
          밸런스 100으로 가기
        </Link>
      </div>
    </main>
  );
}

export default function Balance100SharePage() {
  const { user, loading, login } = useAuth();
  const [payload, setPayload] = useState<BalanceSharePayload | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<PredictionInvite | null>(null);
  const [answers, setAnswers] = useState<BalanceAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [guestStarted, setGuestStarted] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    const tokenParam = params.get("token");
    setToken(tokenParam);
    setPayload(data ? decodeBalanceSharePayload(data) : null);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/balance-100/prediction/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data?.error ?? "공유 링크를 열 수 없습니다.");
        setInvite({
          token: data.token,
          level: normalizeBalanceLevel(data.level),
          questionCount: normalizeBalanceQuestionCount(data.questionCount),
          ownerName: String(data.ownerName ?? "친구"),
          total: Number(data.total ?? 100),
          isOwner: Boolean(data.isOwner),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "공유 링크를 열 수 없습니다."));
  }, [token, user]);

  const level = invite?.level ?? 3;
  const questionCount = invite?.questionCount ?? 100;
  const questions = useMemo(() => getBalanceQuestions(level, questionCount), [level, questionCount]);
  const question = questions[currentIndex];
  const progress = useMemo(() => getBalance100Progress(answers, questions), [answers, questions]);

  const submitPrediction = useCallback(async (nextAnswers: BalanceAnswers, nextGuestName = guestName) => {
    if (!token) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/balance-100/prediction/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: nextAnswers,
          predictorName: nextGuestName.trim().slice(0, 16),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.prediction) throw new Error(data?.error ?? "저장에 실패했습니다.");
      setPredictionResult(data.prediction);
      clearPendingPrediction(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }, [guestName, token]);

  useEffect(() => {
    if (!token || !user || !invite || predictionResult || isSubmitting) return;
    const pending = readPendingPrediction(token);
    if (!pending) return;
    setGuestName(pending.guestName);
    setAnswers(pending.answers);
    if (Object.keys(pending.answers).length >= questions.length) {
      void submitPrediction(pending.answers, pending.guestName);
    }
  }, [invite, isSubmitting, predictionResult, questions.length, submitPrediction, token, user]);

  const pickAnswer = useCallback((value: BalanceAnswerValue) => {
    if (!question || isSubmitting || predictionResult) return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);

    if (Object.keys(nextAnswers).length >= questions.length) {
      if (!user && token) {
        writePendingPrediction(token, nextAnswers, guestName);
        setCurrentIndex(questions.length - 1);
        return;
      }
      void submitPrediction(nextAnswers);
      return;
    }

    const nextIndex = questions.findIndex((item, index) => index > currentIndex && !nextAnswers[item.id]);
    setCurrentIndex(nextIndex >= 0 ? nextIndex : getFirstUnansweredIndex(nextAnswers, questions));
  }, [answers, currentIndex, guestName, isSubmitting, predictionResult, question, questions, submitPrediction, token, user]);

  const loginForPredictionResult = useCallback(() => {
    if (token) {
      writePendingPrediction(token, answers, guestName);
      login(`/balance-100/share?token=${encodeURIComponent(token)}`);
    }
  }, [answers, guestName, login, token]);

  const shareReverse = useCallback(async () => {
    if (!predictionResult?.reverseSharePath) return;
    const url = `${window.location.origin}${predictionResult.reverseSharePath}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "이번엔 내 결과도 비교해봐",
          text: "밸런스 100으로 우리 선택이 얼마나 같은지 비교해봐.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("링크가 복사됐어요.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus("링크가 복사됐어요.");
      } catch {
        setShareStatus("링크 복사에 실패했어요.");
      }
    }
  }, [predictionResult?.reverseSharePath]);

  if (typeof payload === "undefined" || loading) return <LoadingView />;

  if (payload) return <SharedResultView payload={payload} />;

  if (!token) return <ErrorView message="공유 링크가 잘렸거나 만료된 형식입니다." />;

  if (error) return <ErrorView message={error} />;
  if (!invite) return <LoadingView />;

  if (!user && !guestStarted && progress.answered === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-6 text-black">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[38px] font-light leading-none text-black">‹</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance 100</p>
          <h1 className="mt-4 break-keep text-[39px] font-black leading-[1.15] tracking-[-0.07em]">
            닉네임만 적고
            <br />
            바로 비교해보세요
          </h1>
          <p className="mt-5 break-keep text-[17px] font-medium leading-8 text-[#555]">
            {invite.ownerName}님은 이미 완료했어요. 나는 내 기준대로 고르고, 마지막에 얼마나 같은지 확인합니다.
          </p>
          <input
            value={guestName}
            onChange={(event) => setGuestName(event.target.value.slice(0, 16))}
            placeholder="내 닉네임"
            maxLength={16}
            className="mt-8 h-[58px] w-full rounded-[24px] border border-[#E5E7EB] bg-white px-5 text-[17px] font-black text-[#111827] outline-none transition placeholder:text-[#B7BCC5] focus:border-[#20D879] focus:bg-[#F0FFF7]"
          />
          <button
            type="button"
            onClick={() => setGuestStarted(true)}
            disabled={!guestName.trim()}
            className="mt-4 h-[64px] rounded-[34px] text-[18px] font-black text-white disabled:opacity-40"
            style={{ backgroundColor: GREEN }}
          >
            시작하기
          </button>
        </div>
      </main>
    );
  }

  if (!user && progress.answered >= questions.length) {
    return (
      <main className="min-h-screen bg-white px-6 py-6 text-black">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">{questions.length} / {questions.length} 완료</p>
          <h1 className="mt-4 break-keep text-[39px] font-black leading-[1.15] tracking-[-0.07em]">
            결과 확인은
            <br />
            카카오 로그인 후 열려요
          </h1>
          <p className="mt-5 break-keep text-[17px] font-medium leading-8 text-[#555]">
            지금까지 고른 답은 이 화면에서만 보관 중입니다. 로그인하면 바로 결과를 계산해 보여드릴게요.
          </p>
          <button
            type="button"
            onClick={loginForPredictionResult}
            className="mt-8 h-[64px] rounded-[34px] bg-[#FEE500] text-[18px] font-black text-[#191919]"
          >
            카카오로 결과 확인하기
          </button>
        </div>
      </main>
    );
  }

  if (invite.isOwner) {
    return (
      <main className="min-h-screen bg-white px-6 py-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance 100</p>
          <h1 className="mt-4 text-[36px] font-black leading-[1.15] tracking-[-0.06em] text-black">내가 만든 비교 링크예요.</h1>
          <p className="mt-3 break-keep text-[16px] font-medium leading-7 text-[#555]">
            이 링크는 친구에게 보내는 용도입니다. 친구가 자기 기준대로 고르면 나와 얼마나 같은지 비교됩니다.
          </p>
          <Link href="/balance-100" className="mt-8 flex h-[66px] items-center justify-center rounded-[34px] text-[17px] font-black text-white" style={{ backgroundColor: GREEN }}>
            내 결과로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (predictionResult) {
    return (
      <main className="min-h-screen bg-white px-6 py-4">
        <div className="mx-auto max-w-md">
          <TopProgress progressRatio={100} backHref="/balance-100" />
          <section className="rounded-[34px] border border-[#D9F7E5] bg-[#F0FFF7] p-6">
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Match Result</p>
            <h1 className="mt-4 text-[40px] font-black leading-[1.08] tracking-[-0.08em] text-black">
              {predictionResult.tierTitle}
            </h1>
            <p className="mt-5 break-keep text-[16px] font-medium leading-8 text-[#555]">
              {predictionResult.tierDesc}
            </p>
            <div className="mt-6 rounded-[26px] bg-white p-5">
              <p className="text-[12px] font-bold text-[#777]">{invite.ownerName}님과 선택 일치율</p>
              <p className="mt-1 text-[38px] font-black tracking-[-0.06em] text-black">
                {predictionResult.matchedCount}/{questions.length}
              </p>
              <p className="text-[13px] font-bold text-[#20D879]">{predictionResult.percent}% 일치</p>
            </div>
          </section>

          <div className="mt-5 grid gap-3">
            {predictionResult.reverseSharePath && (
              <PrimaryButton onClick={shareReverse}>
                이번엔 내 결과도 공유하기
              </PrimaryButton>
            )}
            <Link
              href="/balance-100"
              className="flex h-[62px] items-center justify-center rounded-[34px] bg-black text-[17px] font-black text-white"
            >
              내 밸런스 결과 보기
            </Link>
            {shareStatus && <p className="text-center text-[12px] font-bold text-[#20D879]">{shareStatus}</p>}
          </div>
        </div>
      </main>
    );
  }

  const progressRatio = Math.round((progress.answered / questions.length) * 100);

  return (
    <main className="min-h-screen bg-white px-6 py-4 text-black">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col">
        <TopProgress progressRatio={progressRatio} />

        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">
          {currentIndex + 1} / {questions.length}
        </p>
        <h1 className="mt-5 break-keep text-[34px] font-black leading-[1.23] tracking-[-0.06em] text-black">
          나는
          <br />
          뭘 골랐을까?
        </h1>
        <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-[#9A9A9A]">
          정답은 없어요. 내 기준대로 고르면 마지막에 친구와 비교됩니다.
        </p>

        <div className="mt-10 grid gap-4">
          <ChoiceCard label="A" value={question.left} disabled={isSubmitting} onClick={() => pickAnswer("A")} />
          <ChoiceCard label="B" value={question.right} disabled={isSubmitting} onClick={() => pickAnswer("B")} />
        </div>

        <div className="mt-auto flex gap-3 pb-2 pt-8">
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0 || isSubmitting}
            className="h-[54px] flex-1 rounded-[28px] border border-[#E5E7EB] text-[14px] font-black text-[#777] disabled:opacity-30"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIndex >= questions.length - 1 || isSubmitting}
            className="h-[54px] flex-1 rounded-[28px] text-[14px] font-black text-white disabled:opacity-30"
            style={{ backgroundColor: GREEN }}
          >
            다음 문항
          </button>
        </div>
      </div>
    </main>
  );
}
