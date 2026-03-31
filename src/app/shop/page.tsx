"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as PortOne from "@portone/browser-sdk/v2";

const PACKAGES = [
  {
    id: "basic",
    credits: 10,
    price: 1900,
    priceStr: "1,900",
    per: "190원/회",
    label: null,
  },
  {
    id: "plus",
    credits: 30,
    price: 4900,
    priceStr: "4,900",
    per: "163원/회",
    label: "인기",
  },
  {
    id: "pro",
    credits: 70,
    price: 9900,
    priceStr: "9,900",
    per: "141원/회",
    label: "최고혜택",
  },
];

const PG_METHODS = [
  { id: "kakaopay", label: "카카오페이", color: "#FEE500", textColor: "#191919", channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KAKAOPAY, payMethod: "EASY_PAY" as const },
];

type Status = "idle" | "loading" | "success" | "error";

export default function ShopPage() {
  const [selected, setSelected] = useState("plus");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [earnedCredits, setEarnedCredits] = useState(0);
  const router = useRouter();

  const pkg = PACKAGES.find((p) => p.id === selected)!;

  const handlePay = async (pgMethod: typeof PG_METHODS[0]) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      // 1. 결제 준비 (서버에서 paymentId 발급)
      const prepRes = await fetch("/api/payment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selected }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) {
        setErrorMsg(prep.error ?? "결제 준비 실패");
        setStatus("error");
        return;
      }

      // 2. PortOne 결제창 호출
      const result = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: pgMethod.channelKey!,
        paymentId: prep.paymentId,
        orderName: prep.orderName,
        totalAmount: prep.amount,
        currency: "KRW",
        payMethod: pgMethod.payMethod,
        customer: {
          customerId: prep.userId,
          fullName: prep.userName ?? "사용자",
        },
      });

      if (result?.code) {
        // 사용자 취소 또는 실패
        if (result.code !== "USER_CANCEL") {
          setErrorMsg(result.message ?? "결제에 실패했어요.");
          setStatus("error");
        } else {
          setStatus("idle");
        }
        return;
      }

      // 3. 서버에서 결제 검증 + 크레딧 적립
      const confirmRes = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: prep.paymentId, packageId: selected }),
      });
      const confirm = await confirmRes.json();
      if (!confirmRes.ok || !confirm.success) {
        setErrorMsg(confirm.error ?? "결제 확인 실패");
        setStatus("error");
        return;
      }

      setEarnedCredits(confirm.credits);
      setStatus("success");
    } catch {
      setErrorMsg("결제 중 오류가 발생했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-dvh bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-6 max-w-xs w-full text-center">
          <div className="w-20 h-20 rounded-full bg-[#C9571A]/15 border-2 border-[#C9571A]/40 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M8 18L14.5 24.5L28 11" stroke="#C9571A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-2xl">충전 완료!</p>
            <p className="text-[#999] text-sm mt-2">크레딧 {earnedCredits}회가 충전됐어요</p>
          </div>
          <button
            onClick={() => router.push("/studio")}
            className="w-full h-[52px] bg-[#C9571A] text-white font-bold text-[16px] rounded-2xl"
          >
            변환 시작하기
          </button>
          <button onClick={() => setStatus("idle")} className="text-sm text-[#555] hover:text-white transition-colors">
            더 충전하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <header className="h-[52px] border-b border-[#1a1a1a] flex items-center px-4 gap-3">
        <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-white font-bold text-[16px]">크레딧 충전</span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-6">

        {/* 크레딧 설명 */}
        <div className="bg-[#C9571A]/10 border border-[#C9571A]/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">✦</span>
          <div>
            <p className="text-[#C9571A] font-bold text-[13px]">크레딧이란?</p>
            <p className="text-[#C9571A]/70 text-[12px] mt-0.5 leading-relaxed break-keep">
              크레딧 1개 = 워터마크 없는 고화질 이미지 변환 1회. 유효기간 없이 잔액 그대로 유지됩니다.
            </p>
          </div>
        </div>

        {/* 패키지 선택 */}
        <div>
          <p className="text-[13px] text-[#666] mb-3">패키지 선택</p>
          <div className="flex flex-col gap-2.5">
            {PACKAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`relative w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all ${
                  selected === p.id
                    ? "border-[#C9571A] bg-[#C9571A]/8"
                    : "border-[#222] bg-[#111] hover:border-[#333]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected === p.id ? "border-[#C9571A] bg-[#C9571A]" : "border-[#444]"
                  }`}>
                    {selected === p.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-[15px]">{p.credits}회</p>
                    <p className="text-[#666] text-[12px]">{p.per}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-[16px]">{p.priceStr}원</p>
                </div>
                {p.label && (
                  <span className={`absolute -top-2.5 left-4 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    p.label === "인기" ? "bg-[#C9571A] text-white" : "bg-[#333] text-[#C9571A]"
                  }`}>
                    {p.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 에러 메시지 */}
        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        {/* 결제 수단 */}
        <div>
          <p className="text-[13px] text-[#666] mb-3">결제 수단 선택</p>
          <div className="flex flex-col gap-2.5">
            {PG_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => handlePay(method)}
                disabled={status === "loading"}
                className="w-full h-[52px] rounded-2xl font-bold text-[15px] transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: method.color, color: method.textColor }}
              >
                {status === "loading" ? (
                  <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>{method.label}</span>
                    <span className="font-normal text-[13px] opacity-70">로 {pkg.priceStr}원 결제</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 안내 */}
        <div className="text-[11px] text-[#444] space-y-1 pb-4">
          <p>• 결제 완료 즉시 크레딧이 충전됩니다.</p>
          <p>• 미사용 크레딧은 결제일로부터 7일 이내 환불 가능합니다.</p>
          <p>• 문의: support@styledrop.cloud</p>
          <p className="pt-1">
            <Link href="/terms" className="underline underline-offset-2 hover:text-white/40 transition-colors">이용약관</Link>
            {" · "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-white/40 transition-colors">개인정보처리방침</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
