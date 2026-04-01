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
  const [showRefund, setShowRefund] = useState(false);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`결제 오류: ${msg}`);
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
                className="w-full h-[60px] rounded-2xl transition-opacity disabled:opacity-50 flex items-center px-5"
                style={{ backgroundColor: method.color, color: method.textColor }}
              >
                {status === "loading" ? (
                  <div className="w-full flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* 카카오 아이콘 */}
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
                      <path fillRule="evenodd" clipRule="evenodd" d="M11 1.5C5.753 1.5 1.5 4.838 1.5 8.955c0 2.637 1.743 4.959 4.38 6.284L4.76 19.49a.3.3 0 00.46.327l5.01-3.353c.255.02.512.031.77.031 5.247 0 9.5-3.338 9.5-7.455 0-4.117-4.253-7.455-9.5-7.455z" fill="#191919"/>
                    </svg>
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[11px] font-medium opacity-60 leading-tight">카카오페이로 결제</span>
                      <span className="text-[20px] font-extrabold leading-tight tracking-tight">{pkg.priceStr}원</span>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 안내 */}
        <div className="text-[11px] text-[#444] space-y-1 pb-4">
          <p>• <span className="text-[#666]">서비스 제공 기간: 결제 완료 즉시 사용 가능</span></p>
          <p>• 결제 완료 즉시 크레딧이 충전됩니다.</p>
          <p>• 미사용 크레딧은 결제일로부터 7일 이내{" "}
            <button
              onClick={() => setShowRefund(true)}
              className="text-[#555] underline underline-offset-2 decoration-[#3a3a3a] hover:text-[#666] transition-colors"
            >환불</button>
            {" "}가능합니다.
          </p>
          <p>• 문의: support@styledrop.cloud</p>
          <p className="pt-1">
            <Link href="/terms" className="underline underline-offset-2 hover:text-white/40 transition-colors">이용약관</Link>
            {" · "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-white/40 transition-colors">개인정보처리방침</Link>
          </p>
        </div>

        {/* 환불 안내 모달 */}
        {showRefund && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowRefund(false)}>
            <div className="bg-[#141414] border border-white/10 rounded-t-3xl p-6 w-full max-w-lg pb-10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-[16px]">환불 안내</h3>
                <button onClick={() => setShowRefund(false)} className="text-[#555] hover:text-white transition-colors text-xl leading-none">×</button>
              </div>
              <div className="flex flex-col gap-3 text-[13px] text-[#888] leading-relaxed">
                <div className="bg-[#1A1A1A] rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-white/70 font-semibold text-[13px]">환불 조건</p>
                  <p>• 미사용 크레딧에 한해 결제일로부터 <span className="text-white/60">7일 이내</span> 전액 환불 가능</p>
                  <p>• 1회 이상 사용 시 <span className="text-white/60">부분 환불</span> 적용</p>
                  <div className="bg-[#0D0D0D] rounded-xl p-3 mt-1 text-[12px] text-[#777] space-y-1.5">
                    <p className="text-white/50 font-semibold">부분 환불 계산 방식</p>
                    <p>환불금 = 결제 금액 − (사용 크레딧 수 × <span className="text-white/60">190원</span>)</p>
                    <p className="text-[#666]">예) 30회 패키지(4,900원)에서 5회 사용 시</p>
                    <p className="text-[#666]">→ 4,900 − (5 × 190) = <span className="text-white/60">3,950원 환불</span></p>
                    <p className="text-[11px] text-[#555] pt-1">* 공제액이 결제금 이상이면 환불 불가</p>
                  </div>
                  <p>• 결제 오류·이중결제는 전액 환불 처리</p>
                </div>
                <div className="bg-[#1A1A1A] rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-white/70 font-semibold text-[13px]">환불 신청 방법</p>
                  <p>아래 메일로 <span className="text-white/60">주문번호 또는 카카오 닉네임</span>을 함께 보내주세요.</p>
                  <a
                    href="mailto:support@styledrop.cloud?subject=환불 요청&body=카카오 닉네임: %0A결제 금액: %0A사유: "
                    className="flex items-center justify-center gap-2 bg-[#C9571A]/15 border border-[#C9571A]/30 text-[#C9571A] font-bold py-3 rounded-xl mt-1 hover:bg-[#C9571A]/20 transition-colors"
                  >
                    ✉ support@styledrop.cloud
                  </a>
                  <p className="text-[11px] text-[#555]">처리 기간: 영업일 기준 3~5일</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
