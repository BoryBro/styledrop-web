"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as PortOne from "@portone/browser-sdk/v2";
import { CREDIT_VALIDITY_TEXT } from "@/lib/credits";
import { PAYMENT_PACKAGES, REFUND_UNIT_PRICE, REFUND_WINDOW_DAYS } from "@/lib/payment-policy";
import GiftCodePanel from "@/components/gift/GiftCodePanel";
import { useAuth } from "@/hooks/useAuth";

const PACKAGES = [
  {
    id: "basic",
    credits: PAYMENT_PACKAGES.basic.credits,
    price: PAYMENT_PACKAGES.basic.amount,
    priceStr: "1,900",
    per: "190원/회",
    label: null,
  },
  {
    id: "plus",
    credits: PAYMENT_PACKAGES.plus.credits,
    price: PAYMENT_PACKAGES.plus.amount,
    priceStr: "4,900",
    per: "163원/회",
    label: "인기",
  },
  {
    id: "pro",
    credits: PAYMENT_PACKAGES.pro.credits,
    price: PAYMENT_PACKAGES.pro.amount,
    priceStr: "9,900",
    per: "141원/회",
    label: "최고혜택",
  },
];

const PG_METHODS = [
  { id: "kakaopay", label: "카카오페이", color: "#FEE500", textColor: "#191919", channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KAKAOPAY, payMethod: "EASY_PAY" as const },
];

type Status = "idle" | "loading" | "success" | "gift_success" | "error";
type GiftShareKakaoSDK = {
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
type PaymentConfirmPayload = {
  success?: boolean;
  retryable?: boolean;
  error?: string;
  credits?: number;
  code?: string;
  expiresAt?: string;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmPayment(paymentId: string, packageId: string, isGift: boolean) {
  const confirmEndpoint = isGift ? "/api/payment/gift/confirm" : "/api/payment/confirm";
  const confirmRetryDelays = [0, 1200, 2400] as const;
  let confirmPayload: PaymentConfirmPayload | null = null;
  let confirmOk = false;

  for (const delay of confirmRetryDelays) {
    if (delay > 0) await sleep(delay);
    const confirmRes = await fetch(confirmEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, packageId }),
    });
    const confirm = await confirmRes.json().catch(() => ({}));
    if (confirmRes.ok && confirm.success) {
      confirmPayload = confirm;
      confirmOk = true;
      break;
    }
    confirmPayload = confirm;
    if (!confirm?.retryable) break;
  }

  return { confirmOk, confirmPayload };
}

const SECTION_CARD =
  "rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]";

const OPTION_CARD_BASE =
  "relative w-full flex items-center justify-between px-4 py-4 rounded-3xl border transition-all";

export default function ShopPage() {
  const { user, loading: authLoading, login } = useAuth();
  const [selected, setSelected] = useState("plus");
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [earnedCredits, setEarnedCredits] = useState(0);
  const [giftCode, setGiftCode] = useState("");
  const [giftExpiresAt, setGiftExpiresAt] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [showGiftConfirm, setShowGiftConfirm] = useState(false);
  const [isSharingGift, setIsSharingGift] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [ownedGiftCredits, setOwnedGiftCredits] = useState("1");
  const [showOwnedGiftConfirm, setShowOwnedGiftConfirm] = useState(false);
  const [isCreatingOwnedGift, setIsCreatingOwnedGift] = useState(false);
  const router = useRouter();

  const pkg = PACKAGES.find((p) => p.id === selected)!;
  const ownedGiftAmount = Math.max(1, Math.floor(Number(ownedGiftCredits) || 1));
  const canCreateOwnedGift = !!user && !authLoading && (credits ?? 0) >= ownedGiftAmount;

  // 모바일 리다이렉트 복귀 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    if (!paymentId) return;

    window.history.replaceState({}, "", "/shop");

    let pending: { packageId: string; isGift: boolean } | null = null;
    try {
      const raw = sessionStorage.getItem("pp_pending");
      if (raw) { pending = JSON.parse(raw) as { packageId: string; isGift: boolean }; sessionStorage.removeItem("pp_pending"); }
    } catch {}

    if (!pending) return;

    const { packageId: pkgId, isGift } = pending;
    setStatus("loading");

    confirmPayment(paymentId, pkgId, isGift).then(({ confirmOk, confirmPayload }) => {
      if (!confirmOk) {
        setErrorMsg(confirmPayload?.error ?? "결제 확인 실패");
        setStatus("error");
        return;
      }
      if (!confirmPayload) {
        setErrorMsg("결제 확인 결과를 읽지 못했어요.");
        setStatus("error");
        return;
      }
      setEarnedCredits(confirmPayload.credits ?? 0);
      if (isGift) {
        setGiftCode(confirmPayload.code ?? "");
        setGiftExpiresAt(confirmPayload.expiresAt ?? "");
        setStatus("gift_success");
      } else {
        setStatus("success");
      }
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCredits(null);
      return;
    }

    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => setCredits(data.credits ?? 0))
      .catch(() => setCredits(0));
  }, [authLoading, user]);

  const handleGiftKakaoShare = async () => {
    if (!giftCode || isSharingGift) return;
    setIsSharingGift(true);
    try {
      const shareUrl = `${window.location.origin}/gift/${encodeURIComponent(giftCode)}`;
      const Kakao = (window as Window & { Kakao?: GiftShareKakaoSDK }).Kakao;
      const isKakaoInitialized = Kakao?.isInitialized?.() ?? false;
      if (!isKakaoInitialized) Kakao?.init?.(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      const sendDefault = Kakao?.Share?.sendDefault;
      if (!sendDefault) throw new Error("Kakao SDK unavailable");

      sendDefault({
        objectType: "text",
        text: `StyleDrop 크레딧 선물을 보냈어 🎁\n선물 코드: ${giftCode}\n링크 열어서 코드 복사하고 마이페이지에서 등록해줘.`,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      });

      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "gift_share_kakao", metadata: { surface: "shop_gift_success" } }),
      }).catch(() => {});
    } catch {
      const shareUrl = `${window.location.origin}/gift/${encodeURIComponent(giftCode)}`;
      await navigator.clipboard.writeText(shareUrl);
    } finally {
      window.setTimeout(() => setIsSharingGift(false), 1500);
    }
  };

  const handlePay = async (pgMethod: typeof PG_METHODS[0], isGift = false, packageIdOverride?: string) => {
    const packageId = packageIdOverride ?? selected;
    setStatus("loading");
    setErrorMsg("");
    try {
      // 1. 결제 준비 (서버에서 paymentId 발급)
      const prepRes = await fetch("/api/payment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) {
        setErrorMsg(prep.error ?? "결제 준비 실패");
        setStatus("error");
        return;
      }

      // 2. PortOne 결제창 호출 (모바일: redirectUrl로 카카오톡 앱 전환)
      try { sessionStorage.setItem("pp_pending", JSON.stringify({ packageId, isGift })); } catch {}

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
        redirectUrl: window.location.origin + "/shop",
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

      // 3. 서버에서 결제 검증 + 크레딧 적립 (또는 선물 코드 발급)
      try { sessionStorage.removeItem("pp_pending"); } catch {}
      const confirmedPaymentId = result?.paymentId ?? prep.paymentId;
      const { confirmOk, confirmPayload } = await confirmPayment(confirmedPaymentId, packageId, isGift);

      if (!confirmOk) {
        setErrorMsg(confirmPayload?.error ?? "결제 확인 실패");
        setStatus("error");
        return;
      }

      const confirmedPayload = confirmPayload;
      if (!confirmedPayload) {
        setErrorMsg("결제 확인 결과를 읽지 못했어요.");
        setStatus("error");
        return;
      }

      setEarnedCredits(confirmedPayload.credits ?? 0);
      if (isGift) {
        setGiftCode(confirmedPayload.code ?? "");
        setGiftExpiresAt(confirmedPayload.expiresAt ?? "");
        setStatus("gift_success");
      } else {
        setStatus("success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`결제 오류: ${msg}`);
      setStatus("error");
    }
  };

  const handleCreateOwnedGift = async () => {
    if (!user) {
      login();
      return;
    }
    if (isCreatingOwnedGift || !canCreateOwnedGift) return;

    setIsCreatingOwnedGift(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/gift/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: ownedGiftAmount }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setErrorMsg(data?.error ?? "선물 코드 생성 실패");
        setStatus("error");
        return;
      }

      setEarnedCredits(data.credits ?? ownedGiftAmount);
      setGiftCode(data.code ?? "");
      setGiftExpiresAt(data.expiresAt ?? "");
      setCredits(typeof data.remainingCredits === "number" ? data.remainingCredits : Math.max(0, (credits ?? 0) - ownedGiftAmount));
      setShowOwnedGiftConfirm(false);
      setStatus("gift_success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "선물 코드 생성 실패";
      setErrorMsg(msg);
      setStatus("error");
    } finally {
      setIsCreatingOwnedGift(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-dvh bg-[#F5F7FB] flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-6 max-w-xs w-full text-center">
          <div className="w-20 h-20 rounded-full bg-[#FFF3EC] border-2 border-[#F0B28E] flex items-center justify-center shadow-[0_10px_24px_rgba(201,87,26,0.12)]">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M8 18L14.5 24.5L28 11" stroke="#C9571A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[#111827] font-bold text-2xl">충전 완료!</p>
            <p className="text-[#4B5563] text-sm mt-2">크레딧 {earnedCredits}회가 충전됐어요</p>
            <p className="text-[#6B7280] text-xs mt-1">유효기간: {CREDIT_VALIDITY_TEXT}</p>
          </div>
          <button
            onClick={() => router.push("/studio")}
            className="w-full h-[52px] bg-[#C9571A] text-white font-bold text-[16px] rounded-2xl shadow-[0_12px_24px_rgba(201,87,26,0.2)]"
          >
            변환 시작하기
          </button>
          <button onClick={() => setStatus("idle")} className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
            더 충전하기
          </button>
        </div>
      </div>
    );
  }

  if (status === "gift_success") {
    const expiryDate = giftExpiresAt ? new Date(giftExpiresAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";
    return (
      <GiftCodePanel
        title="선물 코드 발급 완료!"
        subtitle={`크레딧 ${earnedCredits}회 선물 코드예요`}
        expiryText={`유효기간: ${expiryDate}까지`}
        giftCode={giftCode}
        helperLines={[
          "이 코드를 친구에게 전달하세요.",
          "받는 사람은 링크를 열어 코드 복사 후 마이페이지에서 등록하면 돼요.",
        ]}
        actions={[
          {
            label: isSharingGift ? "카카오톡 여는 중..." : "카카오톡으로 보내기",
            onClick: handleGiftKakaoShare,
            className: "w-full h-[48px] rounded-xl bg-[#FEE500] text-[#191919] font-bold text-[14px] transition-opacity disabled:opacity-50",
            disabled: isSharingGift,
          },
        ]}
        footerAction={{
          label: "더 선물하기",
          onClick: () => setStatus("idle"),
          className: "text-sm text-[#555] hover:text-white transition-colors",
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#F5F7FB] flex flex-col">
      {/* Header */}
      <header className="h-[60px] border-b border-[#E5E7EB] bg-white flex items-center px-4 gap-3">
        <button onClick={() => router.back()} className="text-[#6B7280] hover:text-[#111827] transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-[#111827] font-bold text-[16px]">크레딧 충전</span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-6">

        {/* 크레딧 설명 */}
        <div className={`${SECTION_CARD} px-5 py-4 flex items-start gap-3`}>
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFF3EC] text-lg leading-none">✦</span>
          <div>
            <p className="text-[#C9571A] font-bold text-[13px]">크레딧이란?</p>
            <p className="text-[#6B7280] text-[12px] mt-0.5 leading-relaxed break-keep">
              크레딧 1개 = 워터마크 없는 고화질 이미지 변환 1회. 충전된 크레딧은 {CREDIT_VALIDITY_TEXT} 동안 사용할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 패키지 선택 */}
        <section className={`${SECTION_CARD} p-5`}>
          <div className="mb-4">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-[#9CA3AF]">A. 크레딧 구매하기</p>
            <p className="mt-1 text-[20px] font-bold text-[#111827]">원하는 크레딧 패키지를 고르세요</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {PACKAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`${OPTION_CARD_BASE} ${
                  selected === p.id
                    ? "border-[#E99A6C] bg-[#FFF7F2] shadow-[0_10px_22px_rgba(201,87,26,0.08)]"
                    : "border-[#E5E7EB] bg-[#FAFBFC] hover:border-[#D1D5DB] hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected === p.id ? "border-[#C9571A] bg-[#C9571A]" : "border-[#CBD5E1] bg-white"
                  }`}>
                    {selected === p.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[#111827] font-bold text-[15px]">{p.credits}회</p>
                    <p className="text-[#6B7280] text-[12px]">{p.per}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#111827] font-bold text-[16px]">{p.priceStr}원</p>
                </div>
                {p.label && (
                  <span className={`absolute -top-2.5 left-4 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    p.label === "인기" ? "bg-[#C9571A] text-white" : "bg-[#FFF3EC] text-[#C9571A]"
                  }`}>
                    {p.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 에러 메시지 */}
        {status === "error" && (
          <div className="rounded-2xl border border-[#F3C4C4] bg-[#FFF5F5] px-4 py-3 text-[#C24141] text-sm">
            {errorMsg}
          </div>
        )}

        {/* 결제 수단 */}
        <section className={`${SECTION_CARD} p-5`}>
          <div className="mb-4">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-[#9CA3AF]">결제 수단</p>
            <p className="mt-1 text-[16px] font-bold text-[#111827]">카카오페이로 바로 충전</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {PG_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => handlePay(method)}
                disabled={status === "loading"}
                className="w-full h-[64px] rounded-3xl transition-opacity disabled:opacity-50 flex items-center px-5 shadow-[0_10px_20px_rgba(0,0,0,0.05)]"
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
        </section>

        {/* 선물하기 */}
        <section className={`${SECTION_CARD} p-5`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.16em] text-[#9CA3AF]">B. 크레딧 선물하기</p>
              <p className="mt-1 text-[20px] font-bold text-[#111827]">결제로 선물 코드를 발급해요</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">패키지를 고르면 결제 후 바로 전달할 수 있는 선물 코드가 생성됩니다.</p>
            </div>
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3EC] text-lg">🎁</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {PACKAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedGift(p.id); setShowGiftConfirm(true); }}
                disabled={status === "loading"}
                className={`${OPTION_CARD_BASE} disabled:opacity-50 ${
                  selectedGift === p.id
                    ? "border-[#E99A6C] bg-[#FFF7F2] shadow-[0_10px_22px_rgba(201,87,26,0.08)]"
                    : "border-[#E5E7EB] bg-[#FAFBFC] hover:border-[#D1D5DB] hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedGift === p.id ? "border-[#C9571A] bg-[#C9571A]" : "border-[#CBD5E1] bg-white"
                  }`}>
                    {selectedGift === p.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="text-left">
                    <p className="text-[#111827] font-bold text-[15px]">{p.credits}회 선물</p>
                    <p className="text-[#6B7280] text-[12px]">{p.per}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#111827] font-bold text-[16px]">{p.priceStr}원</p>
                </div>
                {p.label && (
                  <span className={`absolute -top-2.5 left-4 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    p.label === "인기" ? "bg-[#C9571A] text-white" : "bg-[#FFF3EC] text-[#C9571A]"
                  }`}>
                    {p.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 내 크레딧 선물하기 */}
        <section className={`${SECTION_CARD} p-5`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.16em] text-[#9CA3AF]">C. 내 크레딧 선물하기</p>
              <p className="mt-1 text-[20px] font-bold text-[#111827]">내 보유 크레딧으로 바로 보내요</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">이미 가진 크레딧을 1개부터 선물 코드로 바꿀 수 있습니다.</p>
            </div>
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F6FA] text-lg">💌</span>
          </div>

          <div className="rounded-[26px] border border-[#E5E7EB] bg-[#FAFBFC] p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-[#6B7280]">현재 보유</span>
              <span className="text-[14px] font-bold text-[#111827]">
                {authLoading ? "확인 중..." : user ? `${credits ?? 0}크레딧` : "로그인 필요"}
              </span>
            </div>

            {!user ? (
              <button
                onClick={login}
                className="w-full h-[50px] rounded-2xl bg-[#C9571A] text-white font-bold text-[14px] shadow-[0_12px_24px_rgba(201,87,26,0.18)]"
              >
                카카오 로그인 후 선물하기
              </button>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="owned-gift-credits" className="text-[12px] font-medium text-[#6B7280]">선물할 크레딧 수</label>
                  <input
                    id="owned-gift-credits"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={ownedGiftCredits}
                    onChange={(e) => setOwnedGiftCredits(e.target.value)}
                    className="w-full h-[52px] rounded-2xl border border-[#D1D5DB] bg-white px-4 text-[#111827] font-bold text-[15px] outline-none focus:border-[#C9571A]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {[1, 5, 10].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setOwnedGiftCredits(String(amount))}
                      className="rounded-full border border-[#D1D5DB] bg-white px-3 py-1.5 text-[11px] font-bold text-[#4B5563] hover:border-[#E99A6C] hover:text-[#C9571A] transition-colors"
                    >
                      {amount}개
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl bg-white border border-[#E5E7EB] px-3.5 py-3 text-[11px] text-[#6B7280] leading-relaxed">
                  <p>• 최소 1개부터 선물할 수 있어요.</p>
                  <p>• 코드가 발급되면 내 크레딧에서 바로 차감돼요.</p>
                  <p>• 선물 코드는 30일 동안 사용할 수 있어요.</p>
                </div>

                {credits !== null && ownedGiftAmount > (credits ?? 0) && (
                  <p className="text-[11px] text-red-400">보유 크레딧보다 많이 선물할 수 없어요.</p>
                )}

                <button
                  type="button"
                  disabled={!canCreateOwnedGift || isCreatingOwnedGift}
                  onClick={() => setShowOwnedGiftConfirm(true)}
                  className="w-full h-[52px] rounded-2xl bg-[#111827] text-white font-bold text-[14px] shadow-[0_12px_24px_rgba(15,23,42,0.16)] disabled:opacity-40"
                >
                  {isCreatingOwnedGift ? "코드 생성 중..." : `${ownedGiftAmount}크레딧 선물 코드 만들기`}
                </button>
              </>
            )}
          </div>
        </section>

        {/* 선물 결제 확인 모달 */}
        {showGiftConfirm && selectedGift && (() => {
          const giftPkg = PACKAGES.find((p) => p.id === selectedGift)!;
          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6" onClick={() => { setShowGiftConfirm(false); setSelectedGift(null); }}>
              <div className="bg-white border border-[#E5E7EB] rounded-[32px] p-6 w-full max-w-sm flex flex-col gap-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#FFF3EC] text-3xl">🎁</span>
                  <div>
                    <p className="text-[#111827] font-bold text-[17px]">카카오페이로 결제하시겠습니까?</p>
                    <p className="text-[#6B7280] text-[13px] mt-1">{giftPkg.credits}회 선물 코드 · {giftPkg.priceStr}원</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowGiftConfirm(false); setSelectedGift(null); }}
                    className="flex-1 h-[48px] rounded-2xl bg-[#F3F4F6] text-[#4B5563] font-bold text-[14px]"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => { setShowGiftConfirm(false); handlePay(PG_METHODS[0], true, selectedGift); }}
                    className="flex-1 h-[48px] rounded-2xl bg-[#FEE500] text-[#191919] font-bold text-[14px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                      <path fillRule="evenodd" clipRule="evenodd" d="M11 1.5C5.753 1.5 1.5 4.838 1.5 8.955c0 2.637 1.743 4.959 4.38 6.284L4.76 19.49a.3.3 0 00.46.327l5.01-3.353c.255.02.512.031.77.031 5.247 0 9.5-3.338 9.5-7.455 0-4.117-4.253-7.455-9.5-7.455z" fill="#191919"/>
                    </svg>
                    결제하기
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 보유 크레딧 선물 확인 모달 */}
        {showOwnedGiftConfirm && user && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6" onClick={() => setShowOwnedGiftConfirm(false)}>
            <div className="bg-white border border-[#E5E7EB] rounded-[32px] p-6 w-full max-w-sm flex flex-col gap-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F4F6FA] text-3xl">💌</span>
                <div>
                  <p className="text-[#111827] font-bold text-[17px]">{ownedGiftAmount}크레딧을 선물 코드로 만들까요?</p>
                  <p className="text-[#6B7280] text-[13px] mt-1">
                    내 보유 {credits ?? 0} → 발급 후 {Math.max(0, (credits ?? 0) - ownedGiftAmount)}크레딧
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOwnedGiftConfirm(false)}
                  disabled={isCreatingOwnedGift}
                  className="flex-1 h-[48px] rounded-2xl bg-[#F3F4F6] text-[#4B5563] font-bold text-[14px] disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateOwnedGift}
                  disabled={!canCreateOwnedGift || isCreatingOwnedGift}
                  className="flex-1 h-[48px] rounded-2xl bg-[#C9571A] text-white font-bold text-[14px] disabled:opacity-50"
                >
                  {isCreatingOwnedGift ? "만드는 중..." : "코드 만들기"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 안내 */}
        <div className="rounded-[24px] border border-[#E5E7EB] bg-white px-5 py-4 text-[11px] text-[#6B7280] space-y-1 pb-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <p>• <span className="text-[#374151]">서비스 제공 기간: 결제 완료 즉시 사용 가능</span></p>
          <p>• 결제 완료 즉시 크레딧이 충전됩니다.</p>
          <p>• 미사용 크레딧은 결제일로부터 7일 이내{" "}
            <button
              onClick={() => setShowRefund(true)}
              className="text-[#374151] underline underline-offset-2 decoration-[#CBD5E1] hover:text-[#111827] transition-colors"
            >환불</button>
            {" "}가능합니다.
          </p>
          <p>• 문의: support@styledrop.cloud</p>
          <p className="pt-1">
            <Link href="/terms" className="underline underline-offset-2 hover:text-[#111827] transition-colors">이용약관</Link>
            {" · "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[#111827] transition-colors">개인정보처리방침</Link>
          </p>
        </div>

        {/* 환불 안내 모달 */}
        {showRefund && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowRefund(false)}>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-t-[32px] p-6 w-full max-w-lg pb-10 flex flex-col gap-4 shadow-[0_-20px_60px_rgba(15,23,42,0.14)]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-[#111827] font-bold text-[16px]">환불 안내</h3>
                <button onClick={() => setShowRefund(false)} className="text-[#6B7280] hover:text-[#111827] transition-colors text-xl leading-none">×</button>
              </div>
              <div className="flex flex-col gap-3 text-[13px] text-[#6B7280] leading-relaxed">
                <div className="bg-white rounded-[24px] border border-[#E5E7EB] p-4 flex flex-col gap-2">
                  <p className="text-[#111827] font-semibold text-[13px]">환불 조건</p>
                  <p>• 미사용 크레딧에 한해 결제일로부터 <span className="text-[#374151]">{REFUND_WINDOW_DAYS}일 이내</span> 전액 환불 가능</p>
                  <p>• 1회 이상 사용 시 <span className="text-[#374151]">부분 환불</span> 적용</p>
                  <div className="bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-3 mt-1 text-[12px] text-[#6B7280] space-y-1.5">
                    <p className="text-[#111827] font-semibold">부분 환불 계산 방식</p>
                    <p>환불금 = 결제 금액 − (사용 크레딧 수 × <span className="text-[#374151]">{REFUND_UNIT_PRICE}원</span>)</p>
                    <p className="text-[#6B7280]">예) 30회 패키지(4,900원)에서 5회 사용 시</p>
                    <p className="text-[#6B7280]">→ 4,900 − (5 × {REFUND_UNIT_PRICE}) = <span className="text-[#111827]">3,950원 환불</span></p>
                    <p className="text-[11px] text-[#9CA3AF] pt-1">* 공제액이 결제금 이상이면 환불 불가</p>
                  </div>
                  <p>• 결제 오류·이중결제는 전액 환불 처리</p>
                </div>
                <div className="bg-white rounded-[24px] border border-[#E5E7EB] p-4 flex flex-col gap-2">
                  <p className="text-[#111827] font-semibold text-[13px]">환불 신청 방법</p>
                  <p>아래 메일로 <span className="text-[#374151]">주문번호 또는 카카오 닉네임</span>을 함께 보내주세요.</p>
                  <a
                    href="mailto:support@styledrop.cloud?subject=환불 요청&body=카카오 닉네임: %0A결제 금액: %0A사유: "
                    className="flex items-center justify-center gap-2 bg-[#FFF3EC] border border-[#F0B28E] text-[#C9571A] font-bold py-3 rounded-2xl mt-1 hover:bg-[#FDE7DA] transition-colors"
                  >
                    ✉ support@styledrop.cloud
                  </a>
                  <p className="text-[11px] text-[#9CA3AF]">처리 기간: 영업일 기준 3~5일</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
