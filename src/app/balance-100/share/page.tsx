"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BALANCE_DIMENSION_LABELS,
  decodeBalanceSharePayload,
  type BalanceDimension,
  type BalanceSharePayload,
} from "@/lib/balance-100";

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
          className="h-full rounded-full bg-[linear-gradient(90deg,#111827,#E11D48)]"
          style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export default function Balance100SharePage() {
  const [payload, setPayload] = useState<BalanceSharePayload | null | undefined>(undefined);

  useEffect(() => {
    const data = new URLSearchParams(window.location.search).get("data");
    setPayload(data ? decodeBalanceSharePayload(data) : null);
  }, []);

  if (typeof payload === "undefined") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFB] px-5">
        <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#E11D48]" style={{ animation: "spin 1s linear infinite" }} />
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-[#FAFAFB] px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <p className="text-[12px] font-black uppercase tracking-[0.28em] text-[#E11D48]">Balance Lab</p>
          <h1 className="mt-4 text-[34px] font-black tracking-[-0.06em] text-[#111827]">결과 링크를 열 수 없어요.</h1>
          <p className="mt-3 text-[15px] leading-7 text-[#6B7280]">공유 링크가 잘렸거나 만료된 형식입니다.</p>
          <Link href="/balance-100" className="mt-8 flex h-14 items-center justify-center rounded-full bg-[#111827] text-[15px] font-black text-white">
            나도 해보기
          </Link>
        </div>
      </main>
    );
  }

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

        <section className="mt-4 rounded-[28px] border border-[#FFE4E6] bg-[#FFF1F2] p-5">
          <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#E11D48]">Your Turn</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#111827]">너는 몇 개나 같을까?</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#6B7280] break-keep">
            100개의 선택을 끝내면 내 결과를 만들고, 친구에게 다시 공유할 수 있어요.
          </p>
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
