"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AuditionResult = {
  critique: string;
  assigned_role: string;
  style_prompt: string;
};

export default function AuditionResult() {
  const [result, setResult] = useState<AuditionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("sd_au_result");
    const img = sessionStorage.getItem("sd_au_preview");
    if (!raw) { router.replace("/audition/solo"); return; }
    try {
      setResult(JSON.parse(raw));
      setPreview(img);
    } catch {
      router.replace("/audition/solo");
    }
  }, [router]);

  if (!result) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 sticky top-0 z-40">
        <Link href="/studio" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
      </header>
      <main className="max-w-sm mx-auto w-full px-4 py-8 flex flex-col gap-5">
        <div className="text-center">
          <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-1">심사 결과</p>
          <h1 className="text-[22px] font-extrabold text-white">감독님의 판정</h1>
        </div>

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="w-full aspect-square object-cover rounded-2xl border border-white/10" />
        )}

        <div className="bg-[#111] border border-white/8 rounded-2xl px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest mb-1">배정 단역</p>
          <p className="text-white font-extrabold text-[18px]">{result.assigned_role}</p>
        </div>

        <div className="bg-[#111] border border-white/8 rounded-2xl px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest mb-1">감독 심사평</p>
          <p className="text-[#ccc] text-[14px] leading-relaxed">{result.critique}</p>
        </div>

        <div className="bg-[#111] border border-white/8 rounded-2xl px-5 py-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">스틸컷 프롬프트 (개발용)</p>
          <p className="text-[#555] text-[11px] font-mono leading-relaxed">{result.style_prompt}</p>
        </div>

        <button
          onClick={() => { sessionStorage.removeItem("sd_au_result"); sessionStorage.removeItem("sd_au_preview"); router.push("/audition/solo"); }}
          className="w-full bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-4 rounded-2xl text-[15px] transition-colors"
        >
          다시 오디션 보기
        </button>
      </main>
    </div>
  );
}
