"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as PortOne from "@portone/browser-sdk/v2";
import { CREDIT_VALIDITY_TEXT } from "@/lib/credits";
import { PAYMENT_PACKAGES, REFUND_UNIT_PRICE, REFUND_WINDOW_DAYS } from "@/lib/payment-policy";
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
  const giftPkg = PACKAGES.find((p) => p.id === selectedGift) ?? null;
  const ownedGiftAmount = Math.max(1, Math.floor(Number(ownedGiftCredits) || 1));
  const canCreateOwnedGift = !!user && !authLoading && (credits ?? 0) >= ownedGiftAmount;

  // 모바일 리다이렉트 복귀 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    if (!paymentId) return;

    window.history.replaceState({}, "", "/shop");

    // 취소/오류 코드가 있으면 confirm 없이 처리
    const code = params.get("code");
    if (code) {
      try { sessionStorage.removeItem("pp_pending"); } catch {}
      if (code !== "USER_CANCEL") {
        setErrorMsg(params.get("message") ?? "결제에 실패했어요.");
        setStatus("error");
      }
      // USER_CANCEL은 idle 유지 (버튼 다시 활성화됨)
      return;
    }

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
      <div className="min-h-dvh bg-white flex flex-col">
        <header className="h-[60px] border-b border-[#E5E7EB] bg-white flex items-center px-4 gap-3">
          <button onClick={() => setStatus("idle")} className="text-[#6B7280] hover:text-[#111827] transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-[#111827] font-bold text-[16px]">크레딧 충전</span>
        </header>
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 flex flex-col gap-8">
          <div className="space-y-2">
            <p className="text-[30px] font-bold tracking-[-0.03em] text-[#111827]">충전이 완료됐어요.</p>
            <p className="text-[15px] text-[#4B5563]">크레딧 {earnedCredits}회가 바로 반영됐습니다.</p>
          </div>
          <div className="border-y border-[#E5E7EB] py-4 text-[13px] text-[#6B7280]">
            유효기간: {CREDIT_VALIDITY_TEXT}
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/studio")}
              className="h-[52px] bg-[#111827] text-white font-bold text-[15px] rounded-2xl"
            >
              변환 시작하기
            </button>
            <button onClick={() => setStatus("idle")} className="h-[52px] rounded-2xl border border-[#D1D5DB] text-[#111827] font-bold text-[15px]">
              다시 충전하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (status === "gift_success") {
    const expiryDate = giftExpiresAt ? new Date(giftExpiresAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";
    return (
      <div className="min-h-dvh bg-white flex flex-col">
        <header className="h-[60px] border-b border-[#E5E7EB] bg-white flex items-center px-4 gap-3">
          <button onClick={() => setStatus("idle")} className="text-[#6B7280] hover:text-[#111827] transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-[#111827] font-bold text-[16px]">선물 코드</span>
        </header>
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 flex flex-col gap-8">
          <div className="space-y-2">
            <p className="text-[30px] font-bold tracking-[-0.03em] text-[#111827]">선물 코드가 발급됐어요.</p>
            <p className="text-[15px] text-[#4B5563]">크레딧 {earnedCredits}회를 바로 보낼 수 있습니다.</p>
          </div>
          <div className="border-y border-[#E5E7EB] py-5">
            <p className="text-[12px] text-[#6B7280]">선물 코드</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[24px] font-bold tracking-[0.08em] text-[#111827]">{giftCode}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(giftCode)}
                className="shrink-0 rounded-xl border border-[#D1D5DB] px-3 py-2 text-[13px] font-semibold text-[#111827]"
              >
                복사
              </button>
            </div>
            <p className="mt-3 text-[12px] text-[#6B7280]">유효기간: {expiryDate}까지</p>
          </div>
          <p className="text-[13px] leading-relaxed text-[#6B7280]">
            링크를 보내거나 코드를 직접 전달하면 됩니다. 받는 사람은 마이페이지에서 등록할 수 있습니다.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGiftKakaoShare}
              disabled={isSharingGift}
              className="h-[52px] rounded-2xl bg-[#FEE500] text-[#191919] font-bold text-[15px] disabled:opacity-50"
            >
              {isSharingGift ? "카카오톡 여는 중..." : "카카오톡으로 보내기"}
            </button>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="h-[52px] rounded-2xl border border-[#D1D5DB] text-[#111827] font-bold text-[15px]"
            >
              더 선물하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">
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
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] pb-5">
          <div className="min-w-0">
            <p className="text-[12px] text-[#6B7280]">보유 크레딧</p>
            <p className="mt-1 text-[28px] font-bold tracking-[-0.03em] text-[#111827]">
              {authLoading ? "..." : user ? credits ?? 0 : "-"}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#6B7280]">
              1크레딧 = 고화질 1회 · {CREDIT_VALIDITY_TEXT}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOwnedGiftConfirm(true)}
            className="shrink-0 rounded-2xl border border-[#D1D5DB] px-4 py-3 text-[13px] font-semibold text-[#111827]"
          >
            크레딧 선물하기
          </button>
        </div>

        {/* 패키지 선택 */}
        <section className="border-b border-[#E5E7EB] pb-6">
          <div className="mb-4">
            <p className="text-[22px] font-bold tracking-[-0.03em] text-[#111827]">크레딧 구매</p>
            <p className="mt-1 text-[13px] text-[#6B7280]">필요한 패키지를 선택하고 바로 충전하세요.</p>
          </div>
          <div className="flex flex-col">
            {PACKAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`relative flex items-center justify-between gap-4 border-b border-[#F1F5F9] py-4 text-left transition-colors last:border-b-0 ${
                  selected === p.id
                    ? "text-[#111827]"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                    selected === p.id ? "border-[#111827] bg-[#111827]" : "border-[#D1D5DB] bg-white"
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
                <div className="text-right shrink-0">
                  <p className="text-[#111827] font-bold text-[16px]">{p.priceStr}원</p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => handlePay(PG_METHODS[0])}
            disabled={status === "loading"}
            className="mt-5 h-[52px] w-full rounded-2xl bg-[#FEE500] text-[#191919] font-bold text-[15px] disabled:opacity-50"
          >
            {status === "loading" ? "결제 진행 중..." : `카카오페이 ${pkg.priceStr}원 결제`}
          </button>
        </section>

        {/* 에러 메시지 */}
        {status === "error" && (
          <div className="border border-[#F3C4C4] bg-[#FFF5F5] px-4 py-3 text-[#C24141] text-sm">
            {errorMsg}
          </div>
        )}

        {/* 선물하기 */}
        <section className="pb-6">
          <div className="mb-4">
            <div>
              <p className="text-[22px] font-bold tracking-[-0.03em] text-[#111827]">선물하기</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">결제로 선물 코드를 발급해 친구에게 전달할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex flex-col">
            {PACKAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedGift(p.id)}
                disabled={status === "loading"}
                className={`relative flex items-center justify-between gap-4 border-b border-[#F1F5F9] py-4 text-left transition-colors disabled:opacity-50 last:border-b-0 ${
                  selectedGift === p.id
                    ? "text-[#111827]"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                    selectedGift === p.id ? "border-[#111827] bg-[#111827]" : "border-[#D1D5DB] bg-white"
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
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!giftPkg || status === "loading"}
            onClick={() => setShowGiftConfirm(true)}
            className="mt-5 h-[52px] w-full rounded-2xl border border-[#111827] text-[#111827] font-bold text-[15px] disabled:opacity-50"
          >
            {giftPkg ? `${giftPkg.priceStr}원으로 선물 코드 만들기` : "선물할 패키지 선택"}
          </button>
        </section>

        {/* 선물 결제 확인 모달 */}
        {showGiftConfirm && giftPkg && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6" onClick={() => { setShowGiftConfirm(false); setSelectedGift(null); }}>
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <p className="text-[#111827] font-bold text-[19px]">선물 코드를 결제할까요?</p>
                  <p className="text-[#6B7280] text-[13px]">{giftPkg.credits}회 선물 · {giftPkg.priceStr}원</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowGiftConfirm(false); setSelectedGift(null); }}
                    className="flex-1 h-[48px] rounded-2xl border border-[#D1D5DB] text-[#4B5563] font-bold text-[14px]"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => { setShowGiftConfirm(false); handlePay(PG_METHODS[0], true, giftPkg.id); }}
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
        )}

        {/* 보유 크레딧 선물 확인 모달 */}
        {showOwnedGiftConfirm && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6" onClick={() => setShowOwnedGiftConfirm(false)}>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
              {!user ? (
                <>
                  <div className="space-y-2">
                    <p className="text-[#111827] font-bold text-[19px]">로그인이 필요합니다.</p>
                    <p className="text-[#6B7280] text-[13px]">내 보유 크레딧으로 선물 코드를 만들려면 카카오 로그인이 필요합니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowOwnedGiftConfirm(false)}
                      className="flex-1 h-[48px] rounded-2xl border border-[#D1D5DB] text-[#4B5563] font-bold text-[14px]"
                    >
                      닫기
                    </button>
                    <button
                      onClick={login}
                      className="flex-1 h-[48px] rounded-2xl bg-[#111827] text-white font-bold text-[14px]"
                    >
                      로그인
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-[#111827] font-bold text-[19px]">내 크레딧 선물하기</p>
                    <p className="text-[#6B7280] text-[13px]">내 보유 {credits ?? 0}크레딧 중 일부를 선물 코드로 발급합니다.</p>
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="owned-gift-credits" className="block text-[12px] font-medium text-[#6B7280]">선물할 크레딧 수</label>
                    <input
                      id="owned-gift-credits"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={ownedGiftCredits}
                      onChange={(e) => setOwnedGiftCredits(e.target.value)}
                      className="w-full h-[52px] rounded-2xl border border-[#D1D5DB] bg-white px-4 text-[#111827] font-bold text-[15px] outline-none focus:border-[#111827]"
                    />
                    <div className="flex items-center gap-2">
                      {[1, 5, 10].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setOwnedGiftCredits(String(amount))}
                          className="rounded-full border border-[#D1D5DB] px-3 py-1.5 text-[11px] font-bold text-[#4B5563]"
                        >
                          {amount}개
                        </button>
                      ))}
                    </div>
                    <p className="text-[12px] text-[#6B7280]">발급 후 남는 크레딧: {Math.max(0, (credits ?? 0) - ownedGiftAmount)}개</p>
                    {credits !== null && ownedGiftAmount > (credits ?? 0) && (
                      <p className="text-[12px] text-[#C24141]">보유 크레딧보다 많이 선물할 수 없어요.</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowOwnedGiftConfirm(false)}
                      disabled={isCreatingOwnedGift}
                      className="flex-1 h-[48px] rounded-2xl border border-[#D1D5DB] text-[#4B5563] font-bold text-[14px] disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleCreateOwnedGift}
                      disabled={!canCreateOwnedGift || isCreatingOwnedGift}
                      className="flex-1 h-[48px] rounded-2xl bg-[#111827] text-white font-bold text-[14px] disabled:opacity-50"
                    >
                      {isCreatingOwnedGift ? "만드는 중..." : "코드 만들기"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-[#E5E7EB] pt-4 text-[12px] leading-relaxed text-[#6B7280]">
          <p>결제 완료 즉시 크레딧이 충전됩니다.</p>
          <p className="mt-1">
            미사용 크레딧은 결제일로부터 7일 이내{" "}
            <button
              onClick={() => setShowRefund(true)}
              className="text-[#111827] underline underline-offset-2"
            >
              환불
            </button>
            {" "}가능합니다.
          </p>
          <p className="mt-1">문의: support@styledrop.cloud</p>
          <p className="mt-2">
            <Link href="/terms" className="underline underline-offset-2 hover:text-[#111827] transition-colors">이용약관</Link>
            {" · "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[#111827] transition-colors">개인정보처리방침</Link>
          </p>
        </div>

        {/* 환불 안내 모달 */}
        {showRefund && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowRefund(false)}>
            <div className="bg-white border-t border-[#E5E7EB] rounded-t-2xl p-6 w-full max-w-lg pb-10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-[#111827] font-bold text-[16px]">환불 안내</h3>
                <button onClick={() => setShowRefund(false)} className="text-[#6B7280] hover:text-[#111827] transition-colors text-xl leading-none">×</button>
              </div>
              <div className="space-y-3 text-[13px] text-[#6B7280] leading-relaxed">
                <div>
                  <p className="text-[#111827] font-semibold">환불 조건</p>
                  <p className="mt-1">미사용 크레딧은 결제일로부터 {REFUND_WINDOW_DAYS}일 이내 전액 환불 가능합니다.</p>
                  <p className="mt-1">1회 이상 사용 시 부분 환불이 적용됩니다.</p>
                  <p className="mt-1">환불금 = 결제 금액 − (사용 크레딧 수 × {REFUND_UNIT_PRICE}원)</p>
                  <p className="mt-1">결제 오류·이중결제는 전액 환불 처리됩니다.</p>
                </div>
                <div>
                  <p className="text-[#111827] font-semibold">환불 신청</p>
                  <p className="mt-1">주문번호 또는 카카오 닉네임을 함께 보내주세요.</p>
                  <a
                    href="mailto:support@styledrop.cloud?subject=환불 요청&body=카카오 닉네임: %0A결제 금액: %0A사유: "
                    className="mt-3 inline-flex items-center justify-center rounded-xl border border-[#D1D5DB] px-4 py-3 text-[#111827] font-semibold"
                  >
                    support@styledrop.cloud
                  </a>
                  <p className="mt-2 text-[11px] text-[#9CA3AF]">처리 기간: 영업일 기준 3~5일</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
