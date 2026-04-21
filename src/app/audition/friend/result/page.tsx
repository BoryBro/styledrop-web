"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAuditionAvailability } from "@/hooks/useAuditionAvailability";
import {
  buildDuoBattleHref,
  buildDuoRoomHref,
  DUO_SCORE_LABELS,
  type DuoParticipant,
  type DuoParticipantRole,
  type DuoRoomState,
  type DuoSubmission,
  type DuoViewerRole,
} from "@/lib/audition-duo";

const ROOM_POLL_MS = 3000;
const MEDIA_CLASS = "aspect-[3/4] w-full object-cover";

function ComparisonVideoTile({
  participant,
  submission,
}: {
  participant: DuoParticipant;
  submission: DuoSubmission | null;
}) {
  return (
    <div className="rounded-[28px] border border-gray-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <p className="px-2 text-[12px] font-black text-gray-900">{participant.nickname}</p>
      {submission?.videoUrl ? (
        <video
          src={submission.videoUrl}
          controls
          playsInline
          className={`mt-3 rounded-[22px] bg-black ${MEDIA_CLASS}`}
        />
      ) : (
        <div className="mt-3 flex aspect-[3/4] items-center justify-center rounded-[22px] bg-[#f4f5f7] px-4 text-center text-[13px] font-semibold leading-relaxed text-gray-500">
          아직 영상이 없습니다.
        </div>
      )}
    </div>
  );
}

function ParticipantResultCard({
  participant,
  submission,
  isWinner,
  isDraw,
}: {
  participant: DuoParticipant;
  submission: DuoSubmission | null;
  isWinner: boolean;
  isDraw: boolean;
}) {
  const evaluation = submission?.evaluation;

  return (
    <div className={`rounded-[30px] border bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${
      isWinner ? "border-[#315EFB]" : "border-gray-200"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">Player</p>
          <p className="mt-2 text-[24px] font-black leading-tight text-gray-900">{participant.nickname}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${
          isDraw ? "bg-gray-100 text-gray-500" : isWinner ? "bg-[#315EFB] text-white" : "bg-[#F3F4F6] text-gray-500"
        }`}>
          {isDraw ? "DRAW" : isWinner ? "WINNER" : "RUNNER"}
        </span>
      </div>

      {submission?.frameUrl && (
        <div className="mt-4 rounded-[24px] bg-[#fbfbfd] p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">대표 프레임</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={submission.frameUrl} alt={`${participant.nickname} 대표 프레임`} className={`mt-3 rounded-[20px] ${MEDIA_CLASS}`} />
        </div>
      )}

      {evaluation && (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">AI 총평</p>
              <p className="mt-2 text-[18px] font-black leading-snug text-gray-900">{evaluation.oneLiner}</p>
            </div>
            <div className="rounded-[20px] bg-[#111827] px-4 py-3 text-center text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Score</p>
              <p className="mt-1 text-[28px] font-black leading-none">{evaluation.totalScore}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] bg-[#F5F8FF] px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#315EFB]">배역 인상</p>
            <p className="mt-2 text-[16px] font-black text-gray-900">{evaluation.assignedRole}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">{evaluation.critique}</p>
          </div>

          <div className="mt-4 grid gap-3">
            {DUO_SCORE_LABELS.map((label) => (
              <div key={label}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-bold text-gray-700">{label}</span>
                  <span className="text-[13px] font-black text-gray-900">{evaluation.scores[label]}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#315EFB]"
                    style={{ width: `${evaluation.scores[label]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[20px] border border-gray-200 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">잘한 점</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{evaluation.strongestPoint}</p>
            </div>
            <div className="rounded-[20px] border border-gray-200 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">보완 포인트</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{evaluation.improvePoint}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AuditionFriendResultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room")?.trim() ?? "";
  const { loading: authLoading } = useAuth();
  const { isLoading: isAuditionLoading, isEnabled: isAuditionEnabled } = useAuditionAvailability();

  const [room, setRoom] = useState<DuoRoomState | null>(null);
  const [viewerRole, setViewerRole] = useState<DuoViewerRole>("spectator");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuditionLoading && !isAuditionEnabled) {
      router.replace("/studio");
    }
  }, [isAuditionEnabled, isAuditionLoading, router]);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pullRoom = async () => {
      const response = await fetch(`/api/audition/duo/room/${encodeURIComponent(roomId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "결과를 불러오지 못했습니다.");
      }
      if (cancelled) return;
      setRoom(data.room);
      setViewerRole(data.viewerRole ?? "spectator");
      setErrorMsg(null);
    };

    pullRoom().catch((error) => {
      if (!cancelled) {
        setErrorMsg(error instanceof Error ? error.message : "결과를 불러오지 못했습니다.");
      }
    });

    timer = setInterval(() => {
      pullRoom().catch((error) => {
        if (!cancelled) {
          setErrorMsg(error instanceof Error ? error.message : "결과를 불러오지 못했습니다.");
        }
      });
    }, ROOM_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [roomId]);

  if (isAuditionLoading || authLoading || !isAuditionEnabled) return null;

  if (!roomId) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href="/audition/friend" className="text-[14px] font-semibold text-gray-500">← 친구랑 함께하기로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[30px] font-black leading-[1.15] text-gray-900">결과 링크가 올바르지 않습니다.</h1>
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href={roomId ? buildDuoRoomHref(roomId) : "/audition/friend"} className="text-[14px] font-semibold text-gray-500">← 배틀방으로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[28px] font-black leading-[1.15] text-gray-900">결과를 불러오는 중입니다.</h1>
          {errorMsg && <p className="mt-4 text-[14px] leading-relaxed text-[#C9571A]">{errorMsg}</p>}
        </section>
      </main>
    );
  }

  if (viewerRole === "spectator") {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href={buildDuoRoomHref(room.roomId)} className="text-[14px] font-semibold text-gray-500">← 배틀방으로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[28px] font-black leading-[1.15] text-gray-900">이 결과는 참가자만 볼 수 있어요.</h1>
        </section>
      </main>
    );
  }

  if (!room.finishedAt || !room.battle.result) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href={buildDuoBattleHref(room.roomId)} className="text-[14px] font-semibold text-gray-500">← 배틀 화면으로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h1 className="text-[28px] font-black leading-[1.15] text-gray-900">아직 친구 제출이 끝나지 않았어요.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500">
            두 사람의 대표 프레임 평가가 모두 끝나면 이 화면에서 비교 결과가 열립니다.
          </p>
        </section>
      </main>
    );
  }

  const result = room.battle.result;
  const isDraw = result.winnerRole === "draw";
  const winnerRole = result.winnerRole as DuoParticipantRole | "draw";

  return (
    <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
      <Link href={buildDuoRoomHref(room.roomId)} className="text-[14px] font-semibold text-gray-500">← 배틀방으로</Link>

      <section className="mx-auto mt-8 max-w-[820px] space-y-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Battle Result</p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.08] text-gray-900">
            {isDraw ? "이번 판은 거의 비등합니다." : `${winnerRole === "host" ? room.host.nickname : room.guest?.nickname} 승`}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
            {result.summary}
          </p>
        </div>

        {room.battle.scene && (
          <div className="rounded-[30px] border border-gray-200 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#315EFB]">{room.battle.scene.genre}</p>
            <p className="mt-2 text-[24px] font-black leading-tight text-gray-900">{room.battle.scene.title}</p>
            <p className="mt-4 text-[14px] leading-relaxed text-gray-700">{room.battle.scene.direction}</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] bg-[#fbfbfd] px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">대사</p>
                <p className="mt-2 text-[16px] font-black text-gray-900">“{room.battle.scene.dialogue}”</p>
              </div>
              <div className="rounded-[22px] bg-[#fbfbfd] px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">사운드 큐</p>
                <p className="mt-2 text-[14px] text-gray-700">{room.battle.scene.soundCue}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ComparisonVideoTile participant={room.host} submission={room.battle.hostSubmission} />
          {room.guest ? (
            <ComparisonVideoTile participant={room.guest} submission={room.battle.guestSubmission} />
          ) : (
            <div className="rounded-[28px] border border-dashed border-gray-200 bg-white p-3" />
          )}
        </div>

        <ParticipantResultCard
          participant={room.host}
          submission={room.battle.hostSubmission}
          isWinner={winnerRole === "host"}
          isDraw={isDraw}
        />

        {room.guest && (
          <ParticipantResultCard
            participant={room.guest}
            submission={room.battle.guestSubmission}
            isWinner={winnerRole === "guest"}
            isDraw={isDraw}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/studio"
            className="flex items-center justify-center rounded-[22px] border border-gray-200 bg-white px-5 py-4 text-[15px] font-black text-gray-900"
          >
            스튜디오로
          </Link>
          <Link
            href={buildDuoRoomHref(room.roomId)}
            className="flex items-center justify-center rounded-[22px] bg-[#315EFB] px-5 py-4 text-[15px] font-black text-white"
          >
            배틀방 보기
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function AuditionFriendResultPage() {
  return (
    <Suspense fallback={null}>
      <AuditionFriendResultPageContent />
    </Suspense>
  );
}
