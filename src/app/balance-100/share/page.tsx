"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  BALANCE_DIMENSION_LABELS,
  decodeBalanceSharePayload,
  getBalance100Progress,
  getBalanceQuestions,
  getFirstUnansweredIndex,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceDimension,
  type BalanceLevel,
  type BalanceSharePayload,
} from "@/lib/balance-100";

const SCORE_ORDER: BalanceDimension[] = ["money", "love", "social", "pride", "risk", "comfort"];

type PredictionInvite = {
  token: string;
  level: BalanceLevel;
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

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-bold">
        <span className="text-[#111827]">{label}</span>
        <span className="tabular-nums text-[#E11D48]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F1F4]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#111827,#E11D48)]"
          style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function SharedResultView({ payload }: { payload: BalanceSharePayload }) {
  const sortedScores = [...SCORE_ORDER].sort((a, b) => payload.scores[b] - payload.scores[a]);
  const topDimension = sortedScores[0];

  return (
    <main className="min-h-screen bg-[#FAFAFB] px-5 py-6">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[32px] bg-[#111827] text-white shadow-[0_22px_44px_rgba(17,24,39,0.20)]">
          {payload.representativeImageUrl && (
            <div className="aspect-[4/3] w-full overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payload.representativeImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#FB7185]">
              Friend Result
            </p>
            <h1 className="mt-3 text-[34px] font-black leading-[1.05] tracking-[-0.06em]">
              {payload.typeTitle}
            </h1>
            <p className="mt-4 text-[15px] font-medium leading-7 text-white/72 break-keep">
              {payload.typeDesc}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-[11px] font-bold text-white/45">완료 인증</p>
                <p className="mt-1 text-[24px] font-black">100/100</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-[11px] font-bold text-white/45">선택 코드</p>
                <p className="mt-1 text-[24px] font-black tracking-[-0.04em]">{payload.matchCode}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#ECECF1] bg-white p-5">
          <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">Main Signal</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">
            가장 강한 기준은 {BALANCE_DIMENSION_LABELS[topDimension]}
          </h2>
          <div className="mt-5 flex flex-col gap-4">
            {SCORE_ORDER.map((dimension) => (
              <ScoreBar key={dimension} label={BALANCE_DIMENSION_LABELS[dimension]} value={payload.scores[dimension]} />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#ECECF1] bg-white p-5">
          <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">Extreme Picks</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">흔들림 컸던 선택 TOP 5</h2>
          <div className="mt-4 flex flex-col gap-3">
            {payload.topChoices.map((choice, index) => (
              <div key={choice.id} className="rounded-2xl bg-[#F8F8FA] p-4">
                <p className="text-[11px] font-black text-[#E11D48]">#{index + 1} · {choice.picked}</p>
                <p className="mt-1 text-[15px] font-bold leading-6 text-[#111827] break-keep">{choice.text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-5 mt-4 bg-[#FAFAFB]/92 px-5 pb-5 pt-3 backdrop-blur">
          <Link
            href="/balance-100"
            className="flex h-14 w-full items-center justify-center rounded-full bg-[#E11D48] text-[16px] font-black text-white shadow-[0_16px_30px_rgba(225,29,72,0.28)]"
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
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFB] px-5">
      <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#E11D48]" style={{ animation: "spin 1s linear infinite" }} />
    </main>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#FAFAFB] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#E11D48]">Balance Lab</p>
        <h1 className="mt-4 text-[34px] font-black tracking-[-0.06em] text-[#111827]">링크를 열 수 없어요.</h1>
        <p className="mt-3 text-[15px] leading-7 text-[#6B7280]">{message}</p>
        <Link href="/balance-100" className="mt-8 flex h-14 items-center justify-center rounded-full bg-[#111827] text-[15px] font-black text-white">
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
    if (!token || !user) return;
    fetch(`/api/balance-100/prediction/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data?.error ?? "예측 링크를 열 수 없습니다.");
        setInvite({
          token: data.token,
          level: normalizeBalanceLevel(data.level),
          ownerName: String(data.ownerName ?? "친구"),
          total: Number(data.total ?? 100),
          isOwner: Boolean(data.isOwner),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "예측 링크를 열 수 없습니다."));
  }, [token, user]);

  const level = invite?.level ?? 3;
  const questions = useMemo(() => getBalanceQuestions(level), [level]);
  const question = questions[currentIndex];
  const progress = useMemo(() => getBalance100Progress(answers, questions), [answers, questions]);

  const submitPrediction = useCallback(async (nextAnswers: BalanceAnswers) => {
    if (!token) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/balance-100/prediction/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const data = await response.json();
      if (!response.ok || !data?.prediction) throw new Error(data?.error ?? "저장에 실패했습니다.");
      setPredictionResult(data.prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }, [token]);

  const pickAnswer = useCallback((value: BalanceAnswerValue) => {
    if (!question || isSubmitting || predictionResult) return;
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);

    if (Object.keys(nextAnswers).length >= questions.length) {
      void submitPrediction(nextAnswers);
      return;
    }

    const nextIndex = questions.findIndex((item, index) => index > currentIndex && !nextAnswers[item.id]);
    setCurrentIndex(nextIndex >= 0 ? nextIndex : getFirstUnansweredIndex(nextAnswers, questions));
  }, [answers, currentIndex, isSubmitting, predictionResult, question, questions, submitPrediction]);

  const shareReverse = useCallback(async () => {
    if (!predictionResult?.reverseSharePath) return;
    const url = `${window.location.origin}${predictionResult.reverseSharePath}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "이번엔 네가 내 답 맞혀봐",
          text: "밸런스 100으로 내가 어떻게 골랐는지 맞혀봐.",
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

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0F1117] px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[13px] font-bold text-white/50">← StyleDrop</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#FB7185]">Balance 100</p>
          <h1 className="mt-4 text-[38px] font-black leading-[1.02] tracking-[-0.07em] break-keep">
            친구가 보낸 밸런스 예측 링크예요
          </h1>
          <p className="mt-5 text-[16px] font-medium leading-7 text-white/68 break-keep">
            실험실 카드는 로그인 후 참여할 수 있습니다. 카카오 안에서 열려도 로그인하면 이어서 진행됩니다.
          </p>
          <button
            type="button"
            onClick={() => login(`/balance-100/share?token=${encodeURIComponent(token)}`)}
            className="mt-8 h-14 rounded-full bg-[#FEE500] text-[16px] font-black text-[#191919]"
          >
            카카오로 참여하기
          </button>
        </div>
      </main>
    );
  }

  if (error) return <ErrorView message={error} />;
  if (!invite) return <LoadingView />;

  if (invite.isOwner) {
    return (
      <main className="min-h-screen bg-[#FAFAFB] px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#E11D48]">Balance 100</p>
          <h1 className="mt-4 text-[34px] font-black tracking-[-0.06em] text-[#111827]">내가 만든 예측 링크예요.</h1>
          <p className="mt-3 text-[15px] leading-7 text-[#6B7280] break-keep">
            이 링크는 친구에게 보내는 용도입니다. 친구가 로그인하고 들어오면 내 답을 예측하게 됩니다.
          </p>
          <Link href="/balance-100" className="mt-8 flex h-14 items-center justify-center rounded-full bg-[#111827] text-[15px] font-black text-white">
            내 결과로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (predictionResult) {
    return (
      <main className="min-h-screen bg-[#FAFAFB] px-5 py-6">
        <div className="mx-auto max-w-md">
          <section className="rounded-[34px] bg-[#111827] p-6 text-white shadow-[0_24px_48px_rgba(17,24,39,0.22)]">
            <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#FB7185]">Prediction Result</p>
            <h1 className="mt-4 text-[40px] font-black leading-[0.98] tracking-[-0.08em]">
              {predictionResult.tierTitle}
            </h1>
            <p className="mt-5 text-[15px] font-medium leading-7 text-white/72 break-keep">
              {predictionResult.tierDesc}
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-5">
              <p className="text-[12px] font-bold text-white/48">{invite.ownerName}님 답변 예측 성공률</p>
              <p className="mt-1 text-[38px] font-black tracking-[-0.06em]">
                {predictionResult.matchedCount}/100
              </p>
              <p className="text-[13px] font-bold text-white/55">{predictionResult.percent}% 일치</p>
            </div>
          </section>

          <div className="mt-5 grid gap-3">
            {predictionResult.reverseSharePath && (
              <button
                type="button"
                onClick={shareReverse}
                className="h-14 rounded-full bg-[#E11D48] text-[16px] font-black text-white shadow-[0_16px_30px_rgba(225,29,72,0.24)]"
              >
                이번엔 친구에게 내 답 맞히게 하기
              </button>
            )}
            <Link
              href="/balance-100"
              className="flex h-14 items-center justify-center rounded-full bg-[#111827] text-[16px] font-black text-white"
            >
              내 밸런스 결과 보기
            </Link>
            {shareStatus && <p className="text-center text-[12px] font-bold text-[#E11D48]">{shareStatus}</p>}
          </div>
        </div>
      </main>
    );
  }

  const progressRatio = Math.round((progress.answered / questions.length) * 100);

  return (
    <main className="min-h-screen bg-[#0F1117] px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/studio" className="text-[13px] font-bold text-white/48">나가기</Link>
          <span className="text-[13px] font-black tabular-nums text-white/68">
            {progress.answered} / {questions.length}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#FB7185]" style={{ width: `${progressRatio}%` }} />
        </div>
        <p className="mt-3 text-[12px] font-bold text-white/38">
          {invite.ownerName}님이 어떻게 골랐을지 예측하는 중
        </p>

        <div className="flex flex-1 flex-col justify-center py-8">
          <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#FB7185]">
            Question {currentIndex + 1}
          </p>
          <h1 className="mt-4 text-[28px] font-black leading-[1.12] tracking-[-0.06em] break-keep">
            {invite.ownerName}님이라면 뭘 골랐을까?
          </h1>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={() => pickAnswer("A")}
              disabled={isSubmitting}
              className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 text-left transition disabled:opacity-60"
            >
              <p className="text-[12px] font-black text-[#FB7185]">A</p>
              <p className="mt-2 text-[19px] font-black leading-7 break-keep">{question.left}</p>
            </button>
            <button
              type="button"
              onClick={() => pickAnswer("B")}
              disabled={isSubmitting}
              className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 text-left transition disabled:opacity-60"
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
            disabled={currentIndex === 0 || isSubmitting}
            className="h-[52px] flex-1 rounded-full border border-white/10 text-[14px] font-black text-white/60 disabled:opacity-30"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIndex >= questions.length - 1 || isSubmitting}
            className="h-[52px] flex-1 rounded-full bg-white text-[14px] font-black text-[#111827] disabled:opacity-30"
          >
            다음 문항
          </button>
        </div>
      </div>
    </main>
  );
}
