"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAuditionAvailability } from "@/hooks/useAuditionAvailability";
import {
  buildDuoRoomHref,
  canStartDuoRoom,
  DUO_AUDITION_CREDIT_COST,
  type DuoRoomState,
  type DuoViewerRole,
} from "@/lib/audition-duo";

const ROOM_POLL_MS = 3000;

function extractRoomId(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("duo_")) return value;

  try {
    const url = new URL(value);
    return url.searchParams.get("room")?.trim() ?? "";
  } catch {
    return "";
  }
}

function buildAbsoluteShareUrl(roomId: string) {
  if (typeof window === "undefined") return buildDuoRoomHref(roomId);
  return `${window.location.origin}${buildDuoRoomHref(roomId)}`;
}

function ParticipantCard({
  title,
  nickname,
  ready,
  isEmpty,
}: {
  title: string;
  nickname: string | null;
  ready: boolean;
  isEmpty?: boolean;
}) {
  return (
    <div className={`rounded-[28px] border px-5 py-5 ${isEmpty ? "border-dashed border-gray-200 bg-[#fafbff]" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400">{title}</p>
          <p className="mt-2 text-[20px] font-black leading-tight text-gray-900">
            {nickname || "아직 입장 전"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${ready ? "bg-[#EEF6EE] text-[#2F7B39]" : "bg-gray-100 text-gray-400"}`}>
          {ready ? "READY" : isEmpty ? "WAITING" : "NOT READY"}
        </span>
      </div>
    </div>
  );
}

function AuditionFriendPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, login } = useAuth();
  const { isLoading: isAuditionLoading, isEnabled: isAuditionEnabled } = useAuditionAvailability();
  const roomId = searchParams.get("room")?.trim() ?? "";

  const [credits, setCredits] = useState<number | null>(null);
  const [room, setRoom] = useState<DuoRoomState | null>(null);
  const [viewerRole, setViewerRole] = useState<DuoViewerRole>("spectator");
  const [roomInput, setRoomInput] = useState("");
  const [guestName, setGuestName] = useState("초대 친구");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isAuditionLoading && !isAuditionEnabled) {
      router.replace("/studio");
    }
  }, [isAuditionEnabled, isAuditionLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/credits")
      .then((response) => response.json())
      .then((data) => setCredits(data.credits ?? 0))
      .catch(() => setCredits(0));
  }, [user]);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    const response = await fetch(`/api/audition/duo/room/${encodeURIComponent(roomId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "방을 불러오지 못했습니다.");
    }
    setRoom(data.room);
    setViewerRole(data.viewerRole ?? "spectator");
    setErrorMsg(null);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const pull = async () => {
      try {
        if (!cancelled) await fetchRoom();
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(error instanceof Error ? error.message : "방을 불러오지 못했습니다.");
        }
      }
    };

    pull();
    timer = setInterval(pull, ROOM_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [fetchRoom, roomId]);

  const createRoom = useCallback(async () => {
    setIsCreating(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/audition/duo/room", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "방을 만들지 못했습니다.");
      }
      router.replace(data.href);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "방을 만들지 못했습니다.");
    } finally {
      setIsCreating(false);
    }
  }, [router]);

  const runRoomAction = useCallback(async (action: "join" | "set_ready" | "start" | "start_test", extra?: Record<string, unknown>) => {
    if (!roomId) return;
    setIsActing(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/audition/duo/room/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          guestName,
          ...extra,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "방 상태를 바꾸지 못했습니다.");
      }
      setRoom(data.room);
      setViewerRole(data.viewerRole ?? "spectator");
      if ((action === "start" || action === "start_test") && data.room?.status === "live") {
        router.push(`/audition/friend/battle?room=${encodeURIComponent(data.room.roomId)}`);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "방 상태를 바꾸지 못했습니다.");
    } finally {
      setIsActing(false);
    }
  }, [guestName, roomId, router]);

  const shareUrl = useMemo(() => (room ? buildAbsoluteShareUrl(room.roomId) : ""), [room]);
  const myReady = viewerRole === "host"
    ? room?.host.ready ?? false
    : viewerRole === "guest"
      ? room?.guest?.ready ?? false
      : false;

  if (isAuditionLoading || authLoading || !isAuditionEnabled) return null;

  if (!roomId && !user) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href="/audition/intro" className="text-[14px] font-semibold text-gray-500">← AI 오디션 소개로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Friend Battle</p>
          <h1 className="mt-3 text-[30px] font-black leading-[1.15] text-gray-900">친구랑 함께하기는 로그인 후 사용할 수 있어요.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500">
            초대 링크, 참가자 매칭, 결과 비교를 위해 두 사람 모두 로그인 상태가 필요합니다.
          </p>
          <button
            type="button"
            onClick={login}
            className="mt-8 w-full rounded-[22px] bg-black px-5 py-4 text-[16px] font-black text-white"
          >
            카카오로 시작하기
          </button>
        </section>
      </main>
    );
  }

  if (!roomId && credits !== null && credits < DUO_AUDITION_CREDIT_COST) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href="/audition/intro" className="text-[14px] font-semibold text-gray-500">← AI 오디션 소개로</Link>
        <section className="mx-auto mt-16 max-w-[420px] rounded-[32px] border border-gray-200 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Need Credits</p>
          <h1 className="mt-3 text-[30px] font-black leading-[1.15] text-gray-900">친구랑 함께하기는 5크레딧이 필요해요.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500">
            현재 보유 크레딧은 <span className="font-black text-gray-900">{credits}개</span>입니다.
          </p>
          <Link
            href="/studio"
            className="mt-8 flex w-full items-center justify-center rounded-[22px] bg-black px-5 py-4 text-[16px] font-black text-white"
          >
            스튜디오로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  if (!roomId) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
        <Link href="/audition/intro" className="text-[14px] font-semibold text-gray-500">← AI 오디션 소개로</Link>
        <section className="mx-auto mt-10 max-w-[460px]">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Friend Battle</p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.08] text-gray-900">
            친구를 초대해서
            <br />
            같은 씬으로 붙어보세요.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-gray-500">
            방을 만들면 친구가 자기 폰으로 링크에 들어와 같이 시작할 수 있습니다.
          </p>

          <div className="mt-8 rounded-[32px] border border-gray-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400">Create Room</p>
            <button
              type="button"
              onClick={createRoom}
              disabled={isCreating}
              className="mt-4 w-full rounded-[24px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white disabled:opacity-50"
            >
              {isCreating ? "방 만드는 중..." : "새 배틀방 만들기"}
            </button>

            <div className="mt-6 border-t border-gray-100 pt-6">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400">Join Room</p>
              <input
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="초대 링크 또는 room 코드를 붙여넣으세요"
                className="mt-4 w-full rounded-[18px] border border-gray-200 bg-[#fbfbfd] px-4 py-3.5 text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => {
                  const nextRoomId = extractRoomId(roomInput);
                  if (!nextRoomId) {
                    setErrorMsg("올바른 초대 링크 또는 room 코드가 필요합니다.");
                    return;
                  }
                  router.push(buildDuoRoomHref(nextRoomId));
                }}
                className="mt-3 w-full rounded-[20px] border border-gray-200 bg-white px-5 py-3.5 text-[14px] font-black text-gray-900"
              >
                초대 링크로 입장하기
              </button>
            </div>
          </div>

          {errorMsg && <p className="mt-4 text-[13px] font-semibold text-[#C9571A]">{errorMsg}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfbfd] px-6 py-8">
      <Link href="/audition/intro" className="text-[14px] font-semibold text-gray-500">← AI 오디션 소개로</Link>

      <section className="mx-auto mt-8 max-w-[460px]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#315EFB]">Battle Room</p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-black leading-[1.08] text-gray-900">친구랑 함께하기</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
              친구가 입장하고 둘 다 준비 완료하면 바로 다음 단계로 넘어갑니다.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-gray-500 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
            {room?.status?.toUpperCase() ?? "LOADING"}
          </span>
        </div>

        {errorMsg && <p className="mt-5 text-[13px] font-semibold text-[#C9571A]">{errorMsg}</p>}

        <div className="mt-6 rounded-[32px] border border-gray-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="rounded-[24px] bg-[#F5F8FF] px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#315EFB]">Invite Link</p>
            <p className="mt-2 break-all text-[13px] leading-relaxed text-gray-600">{shareUrl || "링크 준비 중..."}</p>
            <button
              type="button"
              onClick={async () => {
                if (!shareUrl) return;
                await navigator.clipboard.writeText(shareUrl);
                setIsCopied(true);
                window.setTimeout(() => setIsCopied(false), 1500);
              }}
              className="mt-3 rounded-[16px] border border-[#D7E2FF] bg-white px-4 py-2.5 text-[13px] font-black text-[#315EFB]"
            >
              {isCopied ? "복사됨" : "초대 링크 복사"}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <ParticipantCard title="방장" nickname={room?.host.nickname ?? null} ready={room?.host.ready ?? false} />
            <ParticipantCard title="친구" nickname={room?.guest?.nickname ?? null} ready={room?.guest?.ready ?? false} isEmpty={!room?.guest} />
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {viewerRole === "spectator" && !room?.guest && (
              user ? (
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => runRoomAction("join")}
                  className="w-full rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white disabled:opacity-50"
                >
                  이 방에 참가하기
                </button>
              ) : (
                <div className="rounded-[22px] border border-gray-200 bg-[#fbfbfd] px-4 py-4">
                  <p className="text-[12px] font-black uppercase tracking-[0.2em] text-gray-400">Temporary Guest</p>
                  <input
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    placeholder="이름을 적어주세요"
                    className="mt-3 w-full rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
                  />
                  <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
                    로그인 없이 임시 친구로 입장합니다.
                  </p>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => runRoomAction("join")}
                    className="mt-4 w-full rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white disabled:opacity-50"
                  >
                    임시 친구로 참가하기
                  </button>
                </div>
              )
            )}

            {viewerRole === "spectator" && room?.guest && (
              <div className="rounded-[22px] border border-[#FFD9D9] bg-[#FFF7F7] px-4 py-4 text-[13px] font-semibold leading-relaxed text-[#C9571A]">
                이미 두 명이 모두 입장한 방입니다. 새 배틀방을 만들어주세요.
              </div>
            )}

            {viewerRole !== "spectator" && room && room.status !== "live" && room.status !== "finished" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => runRoomAction("set_ready", { ready: !myReady })}
                className={`w-full rounded-[22px] px-5 py-4 text-[16px] font-black ${
                  myReady ? "border border-gray-200 bg-white text-gray-900" : "bg-black text-white"
                } disabled:opacity-50`}
              >
                {myReady ? "준비 완료 해제" : "준비 완료"}
              </button>
            )}

            {viewerRole === "host" && room && canStartDuoRoom(room) && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => runRoomAction("start")}
                className="w-full rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white disabled:opacity-50"
              >
                같이 시작하기
              </button>
            )}

            {viewerRole === "host" && room && !room.guest && room.status !== "live" && room.status !== "finished" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => runRoomAction("start_test")}
                className="w-full rounded-[22px] border border-[#D7E2FF] bg-[#F5F8FF] px-5 py-4 text-[16px] font-black text-[#315EFB] disabled:opacity-50"
              >
                혼자 테스트 시작
              </button>
            )}

            {room?.status === "live" && (
              <Link
                href={`/audition/friend/battle?room=${encodeURIComponent(room.roomId)}`}
                className="flex w-full items-center justify-center rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white"
              >
                배틀 화면으로 이동
              </Link>
            )}

            {viewerRole !== "spectator" && room?.status === "finished" && (
              <Link
                href={`/audition/friend/result?room=${encodeURIComponent(room.roomId)}`}
                className="flex w-full items-center justify-center rounded-[22px] bg-[#315EFB] px-5 py-4 text-[16px] font-black text-white"
              >
                결과 보기
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AuditionFriendPage() {
  return (
    <Suspense fallback={null}>
      <AuditionFriendPageContent />
    </Suspense>
  );
}
