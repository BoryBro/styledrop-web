"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function ShareContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [view, setView] = useState<"before" | "after">("after");

  if (!id) {
    return (
      <div className="text-center text-white/50 mt-20">
        유효하지 않은 링크입니다.
      </div>
    );
  }

  const beforeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shared-images/shared/${id}-before.jpg`;
  const afterUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shared-images/shared/${id}-after.jpg`;

  return (
    <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col pb-12 min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</span>
            <span className="text-white/40 text-xs font-medium">사진 한 장, 감성은 AI가</span>
          </Link>
          <Link href="/" className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors">
            시작하기
          </Link>
        </div>
      </header>
      <div className="h-20" /> {/* Spacer */}

      <section className="flex flex-col items-center flex-1">
        <div className="w-full text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            지인이 공유한 AI 변환 결과입니다 ✨
          </h1>
          <p className="text-sm text-white/50">
            버튼을 눌러 원본과 결과물을 비교해 보세요!
          </p>
        </div>

        {/* Custom Toggle Switch */}
        <div className="w-full max-w-sm bg-[#1A1A1A] p-1.5 rounded-full flex relative mb-6 border border-white/10 shadow-lg">
          <div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#333] border border-white/10 rounded-full transition-all duration-300 ease-in-out ${
              view === "after" ? "left-[calc(50%+3px)]" : "left-[4px]"
            }`}
          />
          <button
            onClick={() => setView("before")}
            className={`relative flex-1 py-3 text-sm font-bold z-10 transition-colors ${
              view === "before" ? "text-white" : "text-white/40"
            }`}
          >
            원본 사진 (BEFORE)
          </button>
          <button
            onClick={() => setView("after")}
            className={`relative flex-1 py-3 text-sm font-bold z-10 transition-colors ${
              view === "after" ? "text-point" : "text-white/40"
            }`}
          >
            AI 변환 (AFTER)
          </button>
        </div>

        {/* Image Display */}
        <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] max-w-md rounded-2xl overflow-hidden bg-[#1A1A1A] border-2 border-white/5 shadow-2xl transition-all duration-500 flex items-center justify-center group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view === "before" ? beforeUrl : afterUrl}
            alt={view === "before" ? "Original Image" : "AI Generated Image"}
            className="w-full h-full object-contain"
            // Cache busting unnecessary as IDs are unique timestamps
          />
          
          {/* Floating Label */}
          <div className="absolute top-4 left-4 z-10">
            <span className={`text-xs font-bold tracking-widest px-4 py-2 rounded-full backdrop-blur-md shadow-lg transition-colors ${
              view === "before" ? "bg-black/70 text-white border border-white/20" : "bg-point text-white border border-white/20"
            }`}>
              {view === "before" ? "BEFORE" : "AFTER"}
            </span>
          </div>
          
          {/* Hint Overlay (only visible initially) */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm text-white/80 text-xs px-4 py-2 rounded-full">
              위 버튼을 눌러 상태를 전환하세요
            </div>
          </div>
        </div>
      </section>

      {/* CTA Button */}
      <div className="sticky bottom-4 left-0 right-0 mt-8 px-2">
        <div className="bg-[#111]/80 backdrop-blur-xl p-4 rounded-3xl border border-point/20 shadow-[0_-10px_40px_rgba(201,87,26,0.15)] flex flex-col gap-3 items-center text-center">
          <p className="text-sm font-medium text-white/80">
            마음에 드셨나요? 지금 바로 내 사진도 바꿔보세요!
          </p>
          <Link
            href="/"
            className="w-full bg-point hover:bg-[#B34A12] text-white py-4 rounded-2xl text-lg font-bold transition-all duration-300 shadow-lg shadow-point/30 flex items-center justify-center gap-2 hover:-translate-y-1 active:translate-y-0"
          >
            <span className="text-xl">📸</span> 나도 AI로 사진 변환해보기
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white/50">로딩 중...</div>}>
      <ShareContent />
    </Suspense>
  );
}
