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
const GREEN = "#20D879";

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

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-bold">
        <span className="text-[#111827]">{label}</span>
        <span className="tabular-nums text-[#20D879]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F1F4]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(8, Math.min(100, value))}%`, backgroundColor: GREEN }}
        />
      </div>
    </div>
  );
}

function SharedResultView({ payload }: { payload: BalanceSharePayload }) {
  const sortedScores = [...SCORE_ORDER].sort((a, b) => payload.scores[b] - payload.scores[a]);
  const topDimension = sortedScores[0];

  return (
    <main className="min-h-screen bg-white px-6 py-4">
      <div className="mx-auto max-w-md">
        <TopProgress progressRatio={100} backHref="/balance-100" />
        <section className="overflow-hidden rounded-[32px] border border-[#E9E9E9] bg-white shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
          {payload.representativeImageUrl && (
            <div className="aspect-[4/3] w-full overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payload.representativeImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">
              Friend Result
            </p>
            <h1 className="mt-3 text-[34px] font-black leading-[1.12] tracking-[-0.05em] text-black">
              {payload.typeTitle}
            </h1>
            <p className="mt-4 break-keep text-[16px] font-medium leading-8 text-[#555]">
              {payload.typeDesc}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[24px] bg-[#F5FFF9] p-4">
                <p className="text-[12px] font-bold text-[#777]">완료 인증</p>
                <p className="mt-1 text-[25px] font-black text-black">100/100</p>
              </div>
              <div className="rounded-[24px] bg-[#F5FFF9] p-4">
                <p className="text-[12px] font-bold text-[#777]">선택 코드</p>
                <p className="mt-1 text-[25px] font-black tracking-[-0.04em] text-black">{payload.matchCode}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[30px] border border-[#E9E9E9] bg-white p-6">
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">Main Signal</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">
            가장 강한 기준은 {BALANCE_DIMENSION_LABELS[topDimension]}
          </h2>
          <div className="mt-5 flex flex-col gap-4">
            {SCORE_ORDER.map((dimension) => (
              <ScoreBar key={dimension} label={BALANCE_DIMENSION_LABELS[dimension]} value={payload.scores[dimension]} />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[30px] border border-[#E9E9E9] bg-white p-6">
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-[#20D879]">Pick Review</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">흔들림 컸던 선택 TOP 5</h2>
          <div className="mt-4 flex flex-col gap-3">
            {payload.topChoices.map((choice, index) => (
              <div key={choice.id} className="rounded-[24px] bg-[#F7F7F7] p-4">
                <p className="text-[11px] font-black text-[#20D879]">#{index + 1} · {choice.picked}</p>
                <p className="mt-1 text-[15px] font-bold leading-6 text-[#111827] break-keep">{choice.text}</p>
              </div>
            ))}
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
      <main className="min-h-screen bg-white px-6 py-6 text-black">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link href="/studio" className="mb-8 text-[38px] font-light leading-none text-black">‹</Link>
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance 100</p>
          <h1 className="mt-4 break-keep text-[39px] font-black leading-[1.15] tracking-[-0.07em]">
            친구가 보낸 밸런스 예측 링크예요
          </h1>
          <p className="mt-5 break-keep text-[17px] font-medium leading-8 text-[#555]">
            실험실 카드는 로그인 후 참여할 수 있습니다. 카카오 안에서 열려도 로그인하면 이어서 진행됩니다.
          </p>
          <button
            type="button"
            onClick={() => login(`/balance-100/share?token=${encodeURIComponent(token)}`)}
            className="mt-8 h-[64px] rounded-[34px] bg-[#FEE500] text-[18px] font-black text-[#191919]"
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
      <main className="min-h-screen bg-white px-6 py-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Balance 100</p>
          <h1 className="mt-4 text-[36px] font-black leading-[1.15] tracking-[-0.06em] text-black">내가 만든 예측 링크예요.</h1>
          <p className="mt-3 break-keep text-[16px] font-medium leading-7 text-[#555]">
            이 링크는 친구에게 보내는 용도입니다. 친구가 로그인하고 들어오면 내 답을 예측하게 됩니다.
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
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#20D879]">Prediction Result</p>
            <h1 className="mt-4 text-[40px] font-black leading-[1.08] tracking-[-0.08em] text-black">
              {predictionResult.tierTitle}
            </h1>
            <p className="mt-5 break-keep text-[16px] font-medium leading-8 text-[#555]">
              {predictionResult.tierDesc}
            </p>
            <div className="mt-6 rounded-[26px] bg-white p-5">
              <p className="text-[12px] font-bold text-[#777]">{invite.ownerName}님 답변 예측 성공률</p>
              <p className="mt-1 text-[38px] font-black tracking-[-0.06em] text-black">
                {predictionResult.matchedCount}/100
              </p>
              <p className="text-[13px] font-bold text-[#20D879]">{predictionResult.percent}% 일치</p>
            </div>
          </section>

          <div className="mt-5 grid gap-3">
            {predictionResult.reverseSharePath && (
              <PrimaryButton onClick={shareReverse}>
                이번엔 친구에게 내 답 맞히게 하기
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
          {invite.ownerName}님이라면
          <br />
          뭘 골랐을까?
        </h1>
        <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-[#9A9A9A]">
          친구의 답을 예측해서 골라봐요.
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
