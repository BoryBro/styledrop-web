"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";

// SSR 비활성화 — react-webcam은 브라우저 전용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Webcam = dynamic(() => import("react-webcam") as any, { ssr: false }) as React.ComponentType<any>;

// ── 상수 ──────────────────────────────────────────────────────────────
const STEPS = [
  { cue: "내 주식이 상폐됐는데 애인 앞이라 쿨한 척할 때" },
  { cue: "옆집 좀비가 문 두드리는데 숨 참는 연기" },
  { cue: "세상에서 제일 맛없는 걸 먹고 '이거 진짜 맛있다'고 구라 칠 때" },
];

const VIDEO_CONSTRAINTS = { width: 720, height: 720, facingMode: "user" };

type CaptureItem = { base64: string; dataUrl: string };
type Phase = "intro" | "capture" | "analyzing" | "error";

// ── 컴포넌트 ──────────────────────────────────────────────────────────
export default function AuditionSolo() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const webcamRef = useRef<{ getScreenshot: () => string | null }>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // 카운트다운 클린업
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // 3장 모이면 분석 시작
  useEffect(() => {
    if (captures.length === 0) return;
    if (captures.length < 3) {
      setStepIdx(captures.length); // 다음 스텝으로
      return;
    }
    // 3장 완성
    setPhase("analyzing");
    const images = captures.map(c => c.base64);
    const previewDataUrl = captures[captures.length - 1].dataUrl;

    fetch("/api/audition/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "분석 실패");
        sessionStorage.setItem("sd_au_result", JSON.stringify(data));
        sessionStorage.setItem("sd_au_preview", previewDataUrl);
        router.push("/audition/result");
      })
      .catch(err => {
        setErrorMsg(err.message ?? "감독님이 자리를 비웠습니다. 다시 시도해주세요.");
        setPhase("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures]);

  // 실제 캡처 (카운트다운 끝에 호출)
  const doCapture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) return;
    setCaptures(prev => [...prev, { base64: screenshot.split(",")[1], dataUrl: screenshot }]);
  }, []);

  // 3-2-1 카운트다운 시작
  const startCountdown = useCallback(() => {
    if (countdown !== null) return;
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(countdownRef.current!);
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [countdown, doCapture]);

  // 특정 컷 재촬영
  const retake = (idx: number) => {
    setCaptures(prev => prev.slice(0, idx));
    setStepIdx(idx);
  };

  // ── INTRO ────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6 max-w-sm mx-auto w-full py-10">
          <div className="text-[52px]">🎬</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h1 className="text-[28px] font-extrabold text-white leading-tight">무명배우 탈출기</h1>
            <p className="text-[13px] text-[#555] mt-1.5">Solo 모드</p>
          </div>

          <div className="bg-[#111] border border-white/8 rounded-2xl px-5 py-4 text-left w-full flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[10px] font-bold text-[#C9571A] bg-[#C9571A]/10 border border-[#C9571A]/20 rounded-full w-5 h-5 flex-shrink-0 flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[12px] text-[#888] leading-relaxed">"{s.cue}"</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-[#444] leading-relaxed">
            감독님이 당신의 연기를 냉혹하게 심사합니다.<br />
            카메라를 보고 최선을 다해 연기해주세요.
          </p>

          <button
            onClick={() => setPhase("capture")}
            className="w-full bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-4 rounded-2xl text-[16px] transition-colors"
          >
            지금 당장 오디션 보기
          </button>
          <Link href="/studio" className="text-[13px] text-[#444] hover:text-white transition-colors">
            돌아가기
          </Link>
        </main>
      </div>
    );
  }

  // ── ANALYZING ────────────────────────────────────────────────────
  if (phase === "analyzing") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes dot-bounce { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
        `}</style>
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C9571A] border-r-[#C9571A]/30" style={{ animation: "spin 1s linear infinite" }} />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🎬</div>
        </div>
        <div>
          <p className="text-white font-bold text-[18px] leading-snug">
            감독님이 당신의 프로필을<br />쓰레기통에 버릴지 고민 중입니다...
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C9571A]" style={{ animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-[40px]">😵</p>
        <p className="text-white font-bold text-[18px]">오디션이 중단됐습니다</p>
        <p className="text-[#888] text-[14px]">{errorMsg}</p>
        <button
          onClick={() => { setCaptures([]); setStepIdx(0); setPhase("capture"); }}
          className="bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-3.5 px-8 rounded-2xl transition-colors"
        >
          다시 오디션 보기
        </button>
      </div>
    );
  }

  // ── CAPTURE ──────────────────────────────────────────────────────
  return (
    <div className="bg-[#0A0A0A] flex flex-col" style={{ height: "100dvh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0 z-40">
        <Link href="/studio" className="font-[family-name:var(--font-montserrat)] font-bold text-lg tracking-[-0.02em] text-[#C9571A]">StyleDrop</Link>
        {/* 진행 도트 */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i < captures.length
                  ? "w-2 h-2 bg-[#C9571A]"
                  : i === stepIdx
                  ? "w-3 h-2 bg-white"
                  : "w-2 h-2 bg-white/20"
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-3 gap-3 min-h-0">

        {/* 지시문 */}
        <div className="text-center flex-shrink-0">
          <p className="text-[10px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-1">
            STEP {stepIdx + 1} / 3
          </p>
          <p className="text-white font-bold text-[15px] leading-snug px-2">
            "{STEPS[stepIdx].cue}"
          </p>
        </div>

        {/* 웹캠 */}
        <div className="relative flex-1 rounded-2xl overflow-hidden bg-[#111] border border-white/10 min-h-0">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.85}
            videoConstraints={VIDEO_CONSTRAINTS}
            mirrored
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />

          {/* 카운트다운 오버레이 */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <span
                className="text-white font-extrabold leading-none"
                style={{ fontSize: "25vw", textShadow: "0 0 40px rgba(201,87,26,0.9)" }}
              >
                {countdown}
              </span>
            </div>
          )}

          {/* 스텝 뱃지 */}
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
              {stepIdx + 1} / 3
            </span>
          </div>
        </div>

        {/* 촬영된 썸네일 */}
        {captures.length > 0 && (
          <div className="flex gap-2 flex-shrink-0">
            {captures.map((item, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.dataUrl}
                  alt={`컷 ${i + 1}`}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-[#C9571A]"
                />
                <button
                  onClick={() => retake(i)}
                  className="absolute inset-0 bg-black/70 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <span className="text-white text-[9px] font-bold">재촬영</span>
                </button>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#C9571A] rounded-full flex items-center justify-center text-[9px] text-white font-bold pointer-events-none">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 촬영 버튼 */}
        <button
          onClick={startCountdown}
          disabled={countdown !== null}
          className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors flex items-center justify-center gap-2 flex-shrink-0"
        >
          {countdown !== null ? (
            <span className="text-[22px] font-extrabold tabular-nums">{countdown}</span>
          ) : (
            <><span>📸</span><span>이 표정으로 찍기</span></>
          )}
        </button>
      </main>
    </div>
  );
}
