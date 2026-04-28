"use client";

import Link from "next/link";
import { useEffect } from "react";
import { storeReferralCode } from "@/lib/referral";

type ShareClientProps = {
  id: string | null;
  refCode: string | null;
};

export function ShareClient({ id, refCode }: ShareClientProps) {
  useEffect(() => {
    storeReferralCode(refCode);
  }, [refCode]);

  if (!id) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-center text-white/50">
        유효하지 않은 링크입니다.
      </div>
    );
  }

  const afterUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shared-images/shared/${id}-after.jpg`;

  return (
    <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col pb-12 min-h-screen bg-[#0A0A0A]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">
              StyleDrop
            </span>
            <span className="text-white/40 text-xs font-medium">
              사진 한 장, 감성은 AI가
            </span>
          </Link>
          <Link
            href={refCode ? `/?ref=${encodeURIComponent(refCode)}` : "/"}
            className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            시작하기
          </Link>
        </div>
      </header>
      <div className="h-20" />

      <section className="flex flex-col items-center flex-1">
        <div className="w-full text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            지인이 공유한 AI 변환 결과입니다
          </h1>
          <p className="text-sm text-white/50">
            마음에 들면 내 사진도 같은 감성으로 바꿔보세요.
          </p>
        </div>

        <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] max-w-md rounded-2xl overflow-hidden bg-[#1A1A1A] border-2 border-white/5 shadow-2xl transition-all duration-500 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterUrl}
            alt="AI Generated Image"
            className="w-full h-full object-contain"
          />

          <div className="absolute top-4 left-4 z-10">
            <span className="text-xs font-bold tracking-widest px-4 py-2 rounded-full backdrop-blur-md shadow-lg bg-point text-white border border-white/20">
              AFTER
            </span>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 left-0 right-0 mt-8 px-2">
        <div className="bg-[#111]/80 backdrop-blur-xl p-4 rounded-3xl border border-point/20 shadow-[0_-10px_40px_rgba(201,87,26,0.15)] flex flex-col gap-3 items-center text-center">
          <p className="text-sm font-medium text-white/80">
            마음에 드셨나요? 지금 바로 내 사진도 바꿔보세요.
          </p>
          <Link
            href={refCode ? `/?ref=${encodeURIComponent(refCode)}` : "/"}
            className="w-full bg-point hover:bg-[#B34A12] text-white py-4 rounded-2xl text-lg font-bold transition-all duration-300 shadow-lg shadow-point/30 flex items-center justify-center gap-2 hover:-translate-y-1 active:translate-y-0"
          >
            나도 AI로 사진 변환해보기
          </Link>
        </div>
      </div>
    </main>
  );
}
