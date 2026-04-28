"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAuditionAvailability } from "@/hooks/useAuditionAvailability";
import {
  buildDuoResultHref,
  buildDuoRoomHref,
  type DuoBattleScene,
  type DuoRoomState,
  type DuoSubmission,
  type DuoViewerRole,
} from "@/lib/audition-duo";

const ROOM_POLL_MS = 3000;
const SCENE_REVEAL_SEC = 3;
const RECORDING_SEC = 3;
const MEDIA_CLASS = "aspect-[3/4] w-full object-cover";

type BattlePhase = "loading" | "briefing" | "reveal" | "recording" | "review" | "submitting" | "waiting";
type FrameCandidate = {
  id: string;
  timeSec: number;
  dataUrl: string;
};

function formatSeconds(value: number) {
  return `${Math.max(0, Math.ceil(value))}초`;
}

function getSupportedRecordingMimeType() {
  const mimeTypes = [
    "video/mp4;codecs=h264,aac",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const mimeType of mimeTypes) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

function getRecordingFileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}

function getCurrentSubmission(room: DuoRoomState | null, viewerRole: DuoViewerRole): DuoSubmission | null {
  if (!room || viewerRole === "spectator") return null;
  return viewerRole === "host" ? room.battle.hostSubmission : room.battle.guestSubmission;
}

async function waitForEvent(target: EventTarget, eventName: string) {
  await new Promise<void>((resolve, reject) => {
    const handleResolve = () => {
      cleanup();
      resolve();
    };
    const handleReject = () => {
      cleanup();
      reject(new Error(`${eventName} failed`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, handleResolve);
      target.removeEventListener("error", handleReject);
    };

    target.addEventListener(eventName, handleResolve, { once: true });
    target.addEventListener("error", handleReject, { once: true });
  });
}

async function extractFrameCandidatesFromBlob(blob: Blob) {
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(blob);
  video.src = objectUrl;
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  try {
    await waitForEvent(video, "loadedmetadata");
    if (video.readyState < 2) {
      await waitForEvent(video, "loadeddata");
    }

    const durationSec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : RECORDING_SEC;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("프레임 캡처를 시작할 수 없습니다.");

    const ratios = [0.18, 0.4, 0.68, 0.9];
    const candidates: FrameCandidate[] = [];

    for (const ratio of ratios) {
      const targetTime = Math.min(Math.max(durationSec * ratio, 0.1), Math.max(0.15, durationSec - 0.1));
      video.currentTime = targetTime;
      await waitForEvent(video, "seeked");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      candidates.push({
        id: `frame-${ratio}`,
        timeSec: targetTime,
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      });
    }

    return { durationSec, candidates };
  } finally {
    video.pause();
    video.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

function SceneBrief({ scene }: { scene: DuoBattleScene }) {
  return (
    <div className="rounded-[28px] border border-white/20 bg-white/95 px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#315EFB]">{scene.genre}</p>
          <p className="mt-2 text-[24px] font-black leading-tight text-gray-900">{scene.title}</p>
        </div>
        <span className="rounded-full bg-[#F5F8FF] px-3 py-1 text-[11px] font-black text-[#315EFB]">
          공개 {SCENE_REVEAL_SEC}초
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-[22px] bg-[#fbfbfd] px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">씬 지시문</p>
          <p className="mt-2 text-[14px] leading-relaxed text-gray-700">{scene.direction}</p>
        </div>
        <div className="rounded-[22px] bg-[#fbfbfd] px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">예시)</p>
          <p className="mt-2 text-[18px] font-black leading-snug text-gray-900">“{scene.dialogue}”</p>
        </div>
      </div>
    </div>
  );
}

function AuditionFriendBattlePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room")?.trim() ?? "";
  const { user, loading: authLoading, login } = useAuth();
  const { isLoading: isAuditionLoading, isEnabled: isAuditionEnabled } = useAuditionAvailability();

  const [room, setRoom] = useState<DuoRoomState | null>(null);
  const [viewerRole, setViewerRole] = useState<DuoViewerRole>("spectator");
  const [phase, setPhase] = useState<BattlePhase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordingRemaining, setRecordingRemaining] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [analysisFrame, setAnalysisFrame] = useState<FrameCandidate | null>(null);
  const [isReviewVideoReady, setIsReviewVideoReady] = useState(false);
  const handleLogin = useCallback(() => {
    if (typeof window === "undefined") {
      login("/audition/friend");
      return;
    }
    login(`${window.location.pathname}${window.location.search}`);
  }, [login]);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const remainingTimerRef = useRef<number | null>(null);

  const scene = room?.battle.scene ?? null;
  const mySubmission = useMemo(() => getCurrentSubmission(room, viewerRole), [room, viewerRole]);

  useEffect(() => {
    if (!isAuditionLoading && !isAuditionEnabled) {
      router.replace("/studio");
    }
  }, [isAuditionEnabled, isAuditionLoading, router]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      if (remainingTimerRef.current) window.clearInterval(remainingTimerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  useEffect(() => {
    if (phase !== "review" || !recordedUrl || !reviewVideoRef.current) return;

    setIsReviewVideoReady(false);
    reviewVideoRef.current.load();
  }, [phase, recordedUrl]);

  useEffect(() => {
    if (!roomId || !user) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pullRoom = async () => {
      const response = await fetch(`/api/audition/duo/room/${encodeURIComponent(roomId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "배틀방을 불러오지 못했습니다.");
      }
      if (cancelled) return;

      setRoom(data.room);
      setViewerRole(data.viewerRole ?? "spectator");
      setErrorMsg(null);

      const nextRoom = data.room as DuoRoomState;
      const nextViewerRole = (data.viewerRole ?? "spectator") as DuoViewerRole;
      const nextSubmission = getCurrentSubmission(nextRoom, nextViewerRole);

      if (nextRoom.finishedAt) {
        router.replace(buildDuoResultHref(nextRoom.roomId));
        return;
      }

      if (!nextRoom.startedAt || !nextRoom.battle.scene) {
        router.replace(buildDuoRoomHref(nextRoom.roomId));
        return;
      }

      if (nextViewerRole === "spectator") {
        setErrorMsg("참가자만 배틀 화면에 들어올 수 있어요.");
        return;
      }

      if (nextSubmission?.submittedAt && nextSubmission.evaluation) {
        setPhase("waiting");
        return;
      }

      setPhase((current) => (
        current === "loading" || current === "waiting"
          ? "briefing"
          : current
      ));
    };

    pullRoom().catch((error) => {
      if (!cancelled) {
        setErrorMsg(error instanceof Error ? error.message : "배틀방을 불러오지 못했습니다.");
      }
    });

    timer = setInterval(() => {
      pullRoom().catch((error) => {
        if (!cancelled) {
          setErrorMsg(error instanceof Error ? error.message : "배틀방을 불러오지 못했습니다.");
        }
      });
    }, ROOM_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [roomId, router, user]);

  useEffect(() => {
    if (!room?.startedAt || viewerRole === "spectator" || streamRef.current) return;
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 960 },
      },
      audio: true,
    }).then(async (stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        await previewVideoRef.current.play().catch(() => {});
      }
    }).catch(() => {
      if (!cancelled) {
        setErrorMsg("카메라와 마이크 권한이 필요합니다. 브라우저 권한을 확인해주세요.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [room?.startedAt, viewerRole]);

  const startRecording = async () => {
    if (!scene || !streamRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      setErrorMsg("이 브라우저는 영상 녹화를 지원하지 않습니다.");
      return;
    }

    setErrorMsg(null);
    setAnalysisFrame(null);
    setIsReviewVideoReady(false);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }

    const chunks: BlobPart[] = [];
    const mimeType = getSupportedRecordingMimeType();
    const recorder = new MediaRecorder(
      streamRef.current,
      mimeType ? {
        mimeType,
        videoBitsPerSecond: 1_250_000,
        audioBitsPerSecond: 96_000,
      } : undefined
    );

    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      if (remainingTimerRef.current) window.clearInterval(remainingTimerRef.current);
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);

      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
      if (blob.size === 0) {
        setErrorMsg("녹화본을 만들지 못했습니다. 다시 시도해주세요.");
        setPhase("reveal");
        return;
      }

      try {
        const frameData = await extractFrameCandidatesFromBlob(blob);
        const objectUrl = URL.createObjectURL(blob);
        const automaticFrame = frameData.candidates[Math.floor(Math.random() * frameData.candidates.length)] ?? frameData.candidates[0] ?? null;
        setRecordedBlob(blob);
        setRecordedUrl(objectUrl);
        setAnalysisFrame(automaticFrame);
        setPhase("review");
      } catch {
        setErrorMsg("프레임 추출에 실패했습니다. 다시 녹화해주세요.");
        setPhase("reveal");
      }
    };

    recorder.start(250);
    setRecordingRemaining(RECORDING_SEC);
    setPhase("recording");
    remainingTimerRef.current = window.setInterval(() => {
      setRecordingRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);
    stopTimerRef.current = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, RECORDING_SEC * 1000);
  };

  const submitSelection = async () => {
    if (!roomId || !recordedBlob || !analysisFrame) return;

    setPhase("submitting");
    setErrorMsg(null);

    try {
      const frameFile = await dataUrlToFile(analysisFrame.dataUrl, "duo-frame.jpg");
      const videoMimeType = recordedBlob.type || "video/webm";
      const videoFile = new File([recordedBlob], `duo-recording.${getRecordingFileExtension(videoMimeType)}`, {
        type: videoMimeType,
      });
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("frame", frameFile);
      formData.append("frameTimeSec", String(analysisFrame.timeSec));

      const response = await fetch(`/api/audition/duo/room/${encodeURIComponent(roomId)}/submission`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "제출에 실패했습니다.");
      }

      setRoom(data.room);
      setViewerRole(data.viewerRole ?? viewerRole);

      if (data.room?.finishedAt) {
        router.replace(buildDuoResultHref(roomId));
      } else {
        setPhase("waiting");
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "제출에 실패했습니다.");
      setPhase("review");
    }
  };

  if (isAuditionLoading || authLoading || !isAuditionEnabled) return null;

  if (!user) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href="/audition/friend" className="text-[14px] font-semibold text-gray-500">← 친구랑 함께하기로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Friend Battle</p>
          <h1 className="mt-3 text-[30px] font-black leading-[1.15] text-gray-900">로그인 후 참가할 수 있어요.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500">
            영상 제출과 크레딧 차감은 계정 기준으로 처리됩니다.
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="mt-8 w-full rounded-[22px] bg-black px-5 py-4 text-[16px] font-black text-white"
          >
            카카오로 계속하기
          </button>
        </section>
      </main>
    );
  }

  if (!roomId) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href="/audition/friend" className="text-[14px] font-semibold text-gray-500">← 친구랑 함께하기로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[30px] font-black leading-[1.15] text-gray-900">배틀 링크가 올바르지 않습니다.</h1>
        </section>
      </main>
    );
  }

  if (!room || !scene) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href={roomId ? buildDuoRoomHref(roomId) : "/audition/friend"} className="text-[14px] font-semibold text-gray-500">← 배틀방으로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[28px] font-black leading-[1.15] text-gray-900">배틀 정보를 불러오는 중입니다.</h1>
          {errorMsg && <p className="mt-4 text-[14px] leading-relaxed text-[#C9571A]">{errorMsg}</p>}
        </section>
      </main>
    );
  }

  if (viewerRole === "spectator") {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href={buildDuoRoomHref(roomId)} className="text-[14px] font-semibold text-gray-500">← 배틀방으로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[28px] font-black leading-[1.15] text-gray-900">먼저 방에서 참가를 완료해 주세요.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500">
            초대 링크를 연 뒤 배틀방에서 참가하기를 누르면 이 화면으로 들어올 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
      <Link href={buildDuoRoomHref(roomId)} className="text-[14px] font-semibold text-gray-500">← 배틀방으로</Link>

      <section className="mx-auto mt-8 max-w-[480px] space-y-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Live Battle</p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.08] text-gray-900">같은 씬으로 바로 붙습니다.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
            지시문은 시작 전까지 비밀입니다. 시작하면 3초 공개되고, 바로 3초 동안 녹화됩니다.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-[22px] border border-[#FFD9D9] bg-[#FFF7F7] px-4 py-4 text-[13px] font-semibold leading-relaxed text-[#C9571A]">
            {errorMsg}
          </div>
        )}

        <div className="rounded-[32px] border border-gray-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="relative overflow-hidden rounded-[26px] bg-black">
            {phase === "review" && recordedUrl ? (
              <div className="relative">
                {!isReviewVideoReady && analysisFrame?.dataUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={analysisFrame.dataUrl}
                      alt="녹화 미리보기"
                      className={MEDIA_CLASS}
                    />
                    <div className="absolute inset-x-0 bottom-4 flex justify-center">
                      <span className="rounded-full bg-black/65 px-4 py-2 text-[12px] font-black text-white">
                        영상 로딩 중
                      </span>
                    </div>
                  </>
                )}
                <video
                  key={recordedUrl}
                  ref={reviewVideoRef}
                  src={recordedUrl}
                  controls
                  preload="metadata"
                  poster={analysisFrame?.dataUrl}
                  playsInline
                  onLoadedData={() => setIsReviewVideoReady(true)}
                  onCanPlay={() => setIsReviewVideoReady(true)}
                  className={`${MEDIA_CLASS} ${isReviewVideoReady ? "" : "absolute inset-0 opacity-0"}`}
                />
              </div>
            ) : (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className={MEDIA_CLASS}
              />
            )}

            {phase === "reveal" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-[360px]">
                  <SceneBrief scene={scene} />
                </div>
              </div>
            )}

            {phase === "recording" && (
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#FF3B30] px-3 py-1 text-[11px] font-black text-white">REC</span>
                  <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-black text-white">
                    {formatSeconds(recordingRemaining)}
                  </span>
                </div>
                <div className="self-center w-full max-w-[340px] rounded-[22px] bg-black/55 px-4 py-4 text-white backdrop-blur">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">씬 지시문</p>
                  <p className="mt-2 text-[13px] leading-relaxed">{scene.direction}</p>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-white/70">예시)</p>
                  <p className="mt-2 text-[16px] font-black leading-snug">“{scene.dialogue}”</p>
                </div>
              </div>
            )}
          </div>

          {phase === "briefing" && (
            <div className="mt-5 flex flex-col gap-3">
              <div className="rounded-[22px] bg-[#F5F8FF] px-4 py-4 text-center">
                <p className="text-[15px] font-black text-[#315EFB]">지시문은 아직 비밀입니다.</p>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                  지시문을 먼저 확인한 뒤, 준비되면 `연기시작`을 눌러 3초 녹화를 시작하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhase("reveal")}
                className="w-full rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white"
              >
                지시문 확인하기
              </button>
            </div>
          )}

          {phase === "reveal" && (
            <div className="mt-5 flex flex-col gap-3">
              <div className="rounded-[22px] bg-[#F5F8FF] px-4 py-4">
                <p className="text-[15px] font-black text-[#315EFB]">지시문과 예시 대사를 확인하세요.</p>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                  창은 자동으로 닫히지 않습니다. 준비되면 아래 `연기시작`을 눌러 3초 녹화를 시작하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={startRecording}
                className="w-full rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white"
              >
                연기시작
              </button>
            </div>
          )}

          {phase === "review" && (
            <div className="mt-5">
              <div className="rounded-[22px] bg-[#F5F8FF] px-4 py-4">
                <p className="text-[15px] font-black text-[#315EFB]">방금 녹화한 영상을 바로 확인할 수 있어요.</p>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                  위 영상이 내 녹화본입니다. 괜찮으면 이 영상으로 바로 연기 평가를 받을 수 있습니다.
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPhase("reveal");
                    setAnalysisFrame(null);
                    setRecordedBlob(null);
                    if (recordedUrl) {
                      URL.revokeObjectURL(recordedUrl);
                      setRecordedUrl(null);
                    }
                  }}
                  className="w-full rounded-[20px] border border-gray-200 bg-white px-5 py-3.5 text-[14px] font-black text-gray-900"
                >
                  다시 녹화하기
                </button>
                <button
                  type="button"
                  onClick={submitSelection}
                  disabled={!analysisFrame}
                  className="w-full rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white disabled:opacity-50"
                >
                  해당 영상으로 연기 평가받기
                </button>
              </div>
            </div>
          )}

          {phase === "submitting" && (
            <div className="mt-5 rounded-[22px] bg-[#F5F8FF] px-4 py-4 text-center">
              <p className="text-[15px] font-black text-[#315EFB]">AI가 이 프레임을 심사하는 중입니다.</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-600">영상 업로드와 점수 계산을 같이 처리하고 있어요.</p>
            </div>
          )}

          {phase === "waiting" && (
            <div className="mt-5 rounded-[22px] bg-[#F5F8FF] px-4 py-4 text-center">
              <p className="text-[15px] font-black text-[#315EFB]">내 제출은 끝났어요.</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                비교 결과를 계산하고 있습니다. 완료되면 자동으로 결과 화면으로 넘어갑니다.
              </p>
            </div>
          )}
        </div>

        {phase === "waiting" && mySubmission?.frameUrl && (
          <div className="rounded-[28px] border border-gray-200 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400">내 대표 프레임</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mySubmission.frameUrl} alt="제출한 대표 프레임" className="mt-3 aspect-[3/4] w-full rounded-[22px] object-cover" />
          </div>
        )}
      </section>
    </main>
  );
}

export default function AuditionFriendBattlePage() {
  return (
    <Suspense fallback={null}>
      <AuditionFriendBattlePageContent />
    </Suspense>
  );
}
