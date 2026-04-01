"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AuditionResult = {
  critique: string;
  assigned_role: string;
  style_prompt: string;
};

type Phase = "generating" | "ready" | "error";

export default function AuditionResult() {
  const [result, setResult] = useState<AuditionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stillImage, setStillImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("generating");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("sd_au_result");
    const img = sessionStorage.getItem("sd_au_preview");
    if (!raw) { router.replace("/audition/solo"); return; }
    try {
      const parsed: AuditionResult = JSON.parse(raw);
      setResult(parsed);
      setPreview(img);

      const base64 = img ? img.split(",")[1] : null;
      if (!base64) {
        setErrorMsg("촬영 이미지를 찾을 수 없어요.");
        setPhase("error");
        return;
      }

      fetch("/api/audition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg", stylePrompt: parsed.style_prompt }),
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "생성 실패");
          setStillImage(`data:image/jpeg;base64,${data.image}`);
          setPhase("ready");
        })
        .catch(err => {
          setErrorMsg(err.message ?? "스틸컷 생성에 실패했어요.");
          setPhase("error");
        });
    } catch {
      router.replace("/audition/solo");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    sessionStorage.removeItem("sd_au_result");
    sessionStorage.removeItem("sd_au_preview");
    router.push("/audition/solo");
  };

  if (!result) return null;

  // ── GENERATING ──────────────────────────────────────────────────────
  if (phase === "generating") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes dot-bounce { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
        `}</style>
        <div className="relative w-28 h-28">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-28 h-28 rounded-2xl object-cover border border-white/10 opacity-50" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-4 border-transparent border-t-[#C9571A] border-r-[#C9571A]/30" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        </div>
        <div>
          <p className="text-white font-bold text-[18px] leading-snug">
            감독님이 스틸컷을<br />제작 중입니다...
          </p>
          <p className="text-[#555] text-[13px] mt-1.5">"{result.assigned_role}"</p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C9571A]" style={{ animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-[40px]">😵</p>
        <p className="text-white font-bold text-[18px]">스틸컷 생성 실패</p>
        <p className="text-[#888] text-[14px]">{errorMsg}</p>
        <button onClick={handleRetry} className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-3.5 px-8 rounded-2xl transition-colors">
          다시 오디션 보기
        </button>
      </div>
    );
  }

  // ── READY — B급 영화 포스터 ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <style>{`
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.7} 94%{opacity:1} 97%{opacity:0.85} 98%{opacity:1} }
      `}</style>
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 sticky top-0 z-40">
        <Link href="/studio" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
      </header>

      <main className="max-w-sm mx-auto w-full px-4 py-6 flex flex-col gap-4">

        {/* 타이틀 */}
        <div className="text-center">
          <p className="text-[10px] font-bold text-[#C9571A] tracking-[0.25em] uppercase mb-1">🎬 AI 오디션 결과</p>
          <h1
            className="text-[28px] font-extrabold text-white leading-tight"
            style={{ animation: "flicker 4s ease-in-out infinite" }}
          >
            무명배우 탈출기
          </h1>
        </div>

        {/* 스틸컷 이미지 */}
        {stillImage && (
          <div className="relative rounded-2xl overflow-hidden border-2 border-[#2a2a2a] shadow-[0_0_40px_rgba(201,87,26,0.15)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillImage} alt="스틸컷" className="w-full aspect-square object-cover" />

            {/* 필름 스크래치 오버레이 */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)" }} />

            {/* 배역 스탬프 */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4 pt-10">
              <p className="text-[10px] text-[#C9571A] font-bold tracking-[0.2em] uppercase mb-0.5">배정 단역</p>
              <p className="text-white font-extrabold text-[22px] leading-tight">{result.assigned_role}</p>
            </div>

            {/* 상단 필름 번호 */}
            <div className="absolute top-3 left-3 text-[9px] font-mono text-white/30">
              STYLEDROP · AUDITION CUT
            </div>
          </div>
        )}

        {/* 감독 심사평 */}
        <div className="bg-[#111] border border-white/8 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[18px]">🎬</span>
            <span className="text-[10px] font-bold text-[#C9571A] uppercase tracking-widest">감독의 한마디</span>
          </div>
          <p className="text-[#ccc] text-[14px] leading-relaxed">{result.critique}</p>
        </div>

        {/* 스틸컷 프롬프트 (개발용) */}
        <div className="bg-[#0D0D0D] border border-white/5 rounded-xl px-4 py-3">
          <p className="text-[9px] font-bold text-[#2a2a2a] uppercase tracking-widest mb-1">스틸컷 프롬프트 (개발용)</p>
          <p className="text-[#2a2a2a] text-[10px] font-mono leading-relaxed">{result.style_prompt}</p>
        </div>

        {/* 버튼 */}
        <button
          onClick={handleRetry}
          className="w-full bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-4 rounded-2xl text-[15px] transition-colors"
        >
          다시 오디션 보기
        </button>
        <Link href="/studio" className="text-center text-[13px] text-[#444] hover:text-white transition-colors py-1">
          스튜디오로 돌아가기
        </Link>
      </main>
    </div>
  );
}
