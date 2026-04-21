import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import {
  buildDuoBattleResult,
  calculateDuoTotalScore,
  DUO_AUDITION_CREDIT_COST,
  DUO_SCORE_LABELS,
  getDuoSubmissionByRole,
  getDuoViewerRole,
  isTestDuoGuestUserId,
  setDuoSubmissionByRole,
  withResolvedDuoRoomStatus,
  type DuoBattleScene,
  type DuoEvaluation,
  type DuoParticipantRole,
  type DuoScoreMap,
} from "@/lib/audition-duo";
import { addCreditsWithPolicy, getAvailableCredits } from "@/lib/credits.server";
import { readValidatedDuoGuest } from "@/lib/audition-duo-guest.server";
import { getDuoRoomById, updateDuoRoom } from "@/lib/audition-duo.server";
import { createRequestFingerprint, hasActiveRequestEvent, acquireEphemeralRequestLock } from "@/lib/request-lock.server";
import { loadAuditionFeatureControl } from "@/lib/style-controls.server";

type SubmissionRouteContext = {
  params: Promise<{ roomId: string }>;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getRoleForUser(userId: string | null | undefined, room: Awaited<ReturnType<typeof getDuoRoomById>>["room"]) {
  if (!room || !userId) return null;
  const role = getDuoViewerRole(room, userId);
  if (role === "spectator") return null;
  return role;
}

function resolveActor(request: NextRequest, room: Awaited<ReturnType<typeof getDuoRoomById>>["room"]) {
  const session = readSessionFromRequest(request);
  if (session) {
    return {
      type: "session" as const,
      userId: session.id,
      nickname: session.nickname,
      profileImage: session.profileImage,
      role: getRoleForUser(session.id, room),
    };
  }

  const guest = room ? readValidatedDuoGuest(request, room) : null;
  if (guest) {
    return {
      type: "guest" as const,
      userId: guest.userId,
      nickname: guest.nickname,
      profileImage: null,
      role: getRoleForUser(guest.userId, room),
    };
  }

  return {
    type: "spectator" as const,
    userId: null,
    nickname: null,
    profileImage: null,
    role: null,
  };
}

function getFileExtension(mimeType: string, fallback = "bin") {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  return fallback;
}

function clampScore(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function cleanText(value: unknown, fallback: string, maxLength = 180) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeEvaluation(scene: DuoBattleScene, raw: Record<string, unknown>): DuoEvaluation {
  const rawScores = (raw.scores && typeof raw.scores === "object" ? raw.scores : {}) as Record<string, unknown>;
  const scores = Object.fromEntries(
    DUO_SCORE_LABELS.map((label) => [label, clampScore(rawScores[label])])
  ) as DuoScoreMap;

  return {
    assignedRole: cleanText(raw.assignedRole, `${scene.genre} 배틀러`, 30),
    oneLiner: cleanText(raw.oneLiner, `${scene.title}에서 표정은 잡았지만 아직 한 끗이 부족해요.`, 80),
    critique: cleanText(raw.critique, "장면의 의도는 잡았지만 표정의 방향과 밀도를 조금 더 선명하게 가져가야 했어요.", 220),
    strongestPoint: cleanText(raw.strongestPoint, "감정의 방향은 비교적 선명하게 읽혔어요.", 90),
    improvePoint: cleanText(raw.improvePoint, "눈과 입의 긴장을 더 같은 방향으로 묶어주세요.", 90),
    scores,
    totalScore: calculateDuoTotalScore(scores),
  };
}

function buildEvaluationPrompt(scene: DuoBattleScene) {
  return `너는 영화 오디션 현장에서 배우 표정 연기를 심사하는 냉정한 심사위원이다.

업로드된 이미지는 친구 배틀 참가자가 직접 고른 대표 프레임 1장이다.
아래 씬 정보와 비교해서, 이 프레임의 연기가 얼마나 잘 맞는지 평가해라.

씬 정보
- 장르: ${scene.genre}
- 제목: ${scene.title}
- 상황: ${scene.direction}
- 대사: "${scene.dialogue}"
- 사운드 큐: "${scene.soundCue}"

평가 규칙
- 실제로 사진에서 보이는 표정, 시선, 긴장감, 얼굴 방향, 목/어깨 자세만 근거로 판단해라.
- 음성은 들리지 않으므로 발음이나 실제 음성 연기는 판단하지 마라.
- 눈빛과 입 모양이 장면 감정과 같은 방향인지 중요하게 봐라.
- 점수는 0~100 정수.
- 잘했으면 높게 줘도 되지만, 근거 없이 후하게 주지 마라.
- 말투는 짧고 직설적으로. 너무 과한 욕설은 금지.

반드시 JSON만 출력:
{
  "assignedRole": "[이 프레임의 인상을 압축한 짧은 배역명]",
  "oneLiner": "[한 줄 총평. 40자 이내]",
  "critique": "[2~3문장 평가]",
  "strongestPoint": "[가장 좋았던 지점 1문장]",
  "improvePoint": "[가장 아쉬운 지점 1문장]",
  "scores": {
    "이해도": 0,
    "표정연기": 0,
    "임팩트": 0,
    "몰입도": 0
  }
}`;
}

async function evaluateFrame(args: {
  scene: DuoBattleScene;
  frameBase64: string;
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: args.frameBase64,
        },
      },
      {
        text: buildEvaluationPrompt(args.scene),
      },
    ],
    config: {
      responseModalities: ["TEXT"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((part: { text?: string }) => part.text);
  const raw = textPart?.text ?? "{}";
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return normalizeEvaluation(args.scene, parsed);
}

export async function POST(request: NextRequest, { params }: SubmissionRouteContext) {
  const auditionControl = await loadAuditionFeatureControl();
  if (!auditionControl.is_enabled) {
    return jsonError("AI 오디션이 현재 비공개 상태입니다.", 503);
  }

  const { roomId } = await params;
  const supabase = getSupabase();
  const roomRes = await getDuoRoomById(roomId, supabase);

  if (roomRes.error) return jsonError(roomRes.error, 500);
  if (!roomRes.room) return jsonError("방을 찾지 못했습니다.", 404);

  const actor = resolveActor(request, roomRes.room);
  const role = actor.role;
  if (!role) return jsonError("참가자만 제출할 수 있습니다.", 403);
  if (!roomRes.room.startedAt || !roomRes.room.battle.scene) {
    return jsonError("아직 배틀이 시작되지 않았습니다.", 409);
  }

  const existingSubmission = getDuoSubmissionByRole(roomRes.room, role);
  if (existingSubmission?.submittedAt && existingSubmission.evaluation) {
    return jsonError("이미 제출을 완료했습니다.", 409);
  }
  const isTestBattle = role === "host" && isTestDuoGuestUserId(roomRes.room.guest?.userId);

  const requestKey = createRequestFingerprint("audition-duo-submit", [
    actor.userId,
    roomId,
    roomRes.room.battle.scene.id,
  ]);
  const requestLock = acquireEphemeralRequestLock(requestKey, 5 * 60 * 1000);
  if (!requestLock.acquired) {
    return jsonError("같은 제출 요청이 이미 처리 중입니다. 잠시만 기다려주세요.", 409);
  }

  let deductedCredits = 0;
  const startedAtMs = Date.now();

  try {
    const alreadyActive = actor.type === "session"
      ? await hasActiveRequestEvent(supabase, {
          userId: actor.userId,
          requestKey,
          eventTypes: [
            "audition_duo_submission_started",
            "audition_duo_submission_succeeded",
            "audition_duo_submission_failed",
          ],
          activeEventType: "audition_duo_submission_started",
          windowMs: 5 * 60 * 1000,
        })
      : false;

    if (alreadyActive) {
      return jsonError("같은 제출 요청이 이미 처리 중입니다. 잠시만 기다려주세요.", 409);
    }

    await supabase.from("user_events").insert({
      user_id: actor.type === "session" ? actor.userId : null,
      event_type: "audition_duo_submission_started",
      metadata: {
        request_key: requestKey,
        room_id: roomId,
        role,
        actor_type: actor.type,
      },
    });

    const formData = await request.formData();
    const videoFile = formData.get("video");
    const frameFile = formData.get("frame");
    const frameTimeSecRaw = formData.get("frameTimeSec");
    const frameTimeSec = typeof frameTimeSecRaw === "string" ? Number(frameTimeSecRaw) : NaN;

    if (!(videoFile instanceof File) || !(frameFile instanceof File)) {
      return jsonError("영상과 대표 프레임이 모두 필요합니다.", 400);
    }
    if (videoFile.size === 0 || frameFile.size === 0) {
      return jsonError("비어 있는 파일은 제출할 수 없습니다.", 400);
    }
    if (videoFile.size > 24 * 1024 * 1024) {
      return jsonError("영상 파일이 너무 큽니다. 다시 녹화해주세요.", 400);
    }
    if (frameFile.size > 5 * 1024 * 1024) {
      return jsonError("대표 프레임이 너무 큽니다. 다시 선택해주세요.", 400);
    }

    if (actor.type === "session" && !isTestBattle) {
      const latestCredits = await getAvailableCredits(supabase, actor.userId);
      if (latestCredits < DUO_AUDITION_CREDIT_COST) {
        return jsonError(`친구 배틀 제출에는 ${DUO_AUDITION_CREDIT_COST}크레딧이 필요합니다.`, 429);
      }

      const { error: deductError } = await supabase.rpc("deduct_credit", {
        p_user_id: actor.userId,
        p_amount: DUO_AUDITION_CREDIT_COST,
      });
      if (deductError) {
        return jsonError(`친구 배틀 제출에는 ${DUO_AUDITION_CREDIT_COST}크레딧이 필요합니다.`, 429);
      }
      deductedCredits = DUO_AUDITION_CREDIT_COST;
    }

    const now = new Date().toISOString();
    const videoBytes = Buffer.from(await videoFile.arrayBuffer());
    const frameBytes = Buffer.from(await frameFile.arrayBuffer());
    const videoExtension = getFileExtension(videoFile.type || "video/webm", "webm");
    const frameExtension = getFileExtension(frameFile.type || "image/jpeg", "jpg");
    const basePath = `audition/duo/${roomId}/${role}`;
    const videoPath = `${basePath}-video.${videoExtension}`;
    const framePath = `${basePath}-frame.${frameExtension}`;

    const [videoUpload, frameUpload] = await Promise.all([
      supabase.storage.from("shared-images").upload(videoPath, videoBytes, {
        contentType: videoFile.type || "video/webm",
        upsert: true,
      }),
      supabase.storage.from("shared-images").upload(framePath, frameBytes, {
        contentType: frameFile.type || "image/jpeg",
        upsert: true,
      }),
    ]);

    if (videoUpload.error || frameUpload.error) {
      throw new Error(videoUpload.error?.message ?? frameUpload.error?.message ?? "업로드에 실패했습니다.");
    }

    const videoUrl = supabase.storage.from("shared-images").getPublicUrl(videoPath).data.publicUrl;
    const frameUrl = supabase.storage.from("shared-images").getPublicUrl(framePath).data.publicUrl;
    const evaluation = await evaluateFrame({
      scene: roomRes.room.battle.scene,
      frameBase64: frameBytes.toString("base64"),
    });

    const latestRoomRes = await getDuoRoomById(roomId, supabase);
    if (latestRoomRes.error || !latestRoomRes.room) {
      throw new Error(latestRoomRes.error ?? "최신 방 상태를 불러오지 못했습니다.");
    }

    let mergedRoom = setDuoSubmissionByRole(latestRoomRes.room, role as DuoParticipantRole, {
      userId: actor.userId!,
      videoUrl,
      videoPath,
      videoMimeType: videoFile.type || "video/webm",
      frameUrl,
      framePath,
      frameTimeSec: Number.isFinite(frameTimeSec) ? frameTimeSec : null,
      submittedAt: now,
      creditsDeductedAt: now,
      evaluation,
    });

    if (isTestBattle && mergedRoom.battle.guestSubmission) {
      mergedRoom = setDuoSubmissionByRole(mergedRoom, "guest", {
        ...mergedRoom.battle.guestSubmission,
        videoUrl,
        videoPath,
        videoMimeType: videoFile.type || "video/webm",
        frameUrl,
        framePath,
        frameTimeSec: Number.isFinite(frameTimeSec) ? frameTimeSec : null,
      });
    }

    const battleResult = buildDuoBattleResult(mergedRoom, now);
    if (battleResult) {
      mergedRoom = withResolvedDuoRoomStatus({
        ...mergedRoom,
        battle: {
          ...mergedRoom.battle,
          result: battleResult,
        },
        finishedAt: now,
      }, now);
    } else {
      mergedRoom = withResolvedDuoRoomStatus(mergedRoom, now);
    }

    const updated = await updateDuoRoom(mergedRoom, supabase);
    if (updated.error || !updated.room) {
      throw new Error(updated.error ?? "제출 결과를 저장하지 못했습니다.");
    }

    await supabase.from("user_events").insert({
      user_id: actor.type === "session" ? actor.userId : null,
      event_type: "audition_duo_submission_succeeded",
      metadata: {
        request_key: requestKey,
        room_id: roomId,
        role,
        duration_ms: Date.now() - startedAtMs,
        actor_type: actor.type,
      },
    });

    return NextResponse.json({
      ok: true,
      room: updated.room,
      viewerRole: role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "친구 배틀 제출에 실패했습니다.";
    console.error("[audition/duo/submission] error:", error);

    await supabase.from("user_events").insert({
      user_id: actor.type === "session" ? actor.userId : null,
      event_type: "audition_duo_submission_failed",
      metadata: {
        request_key: requestKey,
        room_id: roomId,
        role,
        duration_ms: Date.now() - startedAtMs,
        message,
      },
    });

    if (deductedCredits > 0) {
      await addCreditsWithPolicy(supabase, {
        userId: actor.userId!,
        credits: deductedCredits,
        sourceType: "refund",
        sourceId: `duo_${roomId}_${role}`,
      });
    }

    return jsonError(message, 500);
  } finally {
    requestLock.release();
  }
}
