export const DUO_AUDITION_CREDIT_COST = 5;
export const DUO_SCORE_LABELS = ["이해도", "표정연기", "임팩트", "몰입도"] as const;
export const DUO_TEST_GUEST_USER_ID_PREFIX = "duo_test_guest_";

export type DuoRoomStatus = "waiting" | "ready" | "live" | "finished";
export type DuoParticipantRole = "host" | "guest";
export type DuoViewerRole = DuoParticipantRole | "spectator";
export type DuoScoreLabel = typeof DUO_SCORE_LABELS[number];
export type DuoScoreMap = Record<DuoScoreLabel, number>;

export type DuoParticipant = {
  userId: string;
  nickname: string;
  profileImage: string | null;
  joinedAt: string;
  ready: boolean;
  readyAt: string | null;
  accessToken: string | null;
};

export type DuoBattleScene = {
  id: string;
  genre: string;
  title: string;
  direction: string;
  dialogue: string;
  soundCue: string;
  durationSec: number;
};

export type DuoEvaluation = {
  assignedRole: string;
  oneLiner: string;
  critique: string;
  strongestPoint: string;
  improvePoint: string;
  scores: DuoScoreMap;
  totalScore: number;
};

export type DuoSubmission = {
  userId: string;
  videoUrl: string | null;
  videoPath: string | null;
  videoMimeType: string | null;
  frameUrl: string | null;
  framePath: string | null;
  frameTimeSec: number | null;
  submittedAt: string | null;
  creditsDeductedAt: string | null;
  evaluation: DuoEvaluation | null;
};

export type DuoBattleResult = {
  winnerRole: DuoParticipantRole | "draw";
  winnerUserId: string | null;
  hostTotalScore: number;
  guestTotalScore: number;
  summary: string;
  completedAt: string;
};

export type DuoBattleState = {
  scene: DuoBattleScene | null;
  hostSubmission: DuoSubmission | null;
  guestSubmission: DuoSubmission | null;
  result: DuoBattleResult | null;
};

export type DuoRoomState = {
  kind: "duo_room";
  version: 1;
  mode: "friend-battle";
  roomId: string;
  inviteCode: string;
  status: DuoRoomStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  host: DuoParticipant;
  guest: DuoParticipant | null;
  battle: DuoBattleState;
};

export function isTestDuoGuestUserId(userId: string | null | undefined) {
  return typeof userId === "string" && userId.startsWith(DUO_TEST_GUEST_USER_ID_PREFIX);
}

export function createTestDuoGuestParticipant(now = new Date().toISOString()): DuoParticipant {
  return {
    userId: `${DUO_TEST_GUEST_USER_ID_PREFIX}${Date.now()}`,
    nickname: "테스트 친구",
    profileImage: null,
    joinedAt: now,
    ready: true,
    readyAt: now,
    accessToken: null,
  };
}

export function createTestDuoGuestEvaluation(scene: DuoBattleScene): DuoEvaluation {
  const scores: DuoScoreMap = {
    이해도: 76,
    표정연기: 72,
    임팩트: 68,
    몰입도: 74,
  };

  return {
    assignedRole: `${scene.genre} 테스트 상대`,
    oneLiner: "테스트용 비교 상대 점수입니다.",
    critique: "실제 친구 없이 흐름을 확인할 수 있도록 넣은 임시 평가입니다. 점수 비교 UI와 결과 동선을 확인하는 용도예요.",
    strongestPoint: "결과 페이지 비교 구조를 바로 확인할 수 있습니다.",
    improvePoint: "실전에서는 실제 친구 제출본으로 바뀝니다.",
    scores,
    totalScore: calculateDuoTotalScore(scores),
  };
}

export function createTestDuoGuestSubmission(userId: string, scene: DuoBattleScene, now = new Date().toISOString()): DuoSubmission {
  return {
    userId,
    videoUrl: null,
    videoPath: null,
    videoMimeType: null,
    frameUrl: null,
    framePath: null,
    frameTimeSec: null,
    submittedAt: now,
    creditsDeductedAt: null,
    evaluation: createTestDuoGuestEvaluation(scene),
  };
}

export function createEmptyDuoSubmission(userId: string): DuoSubmission {
  return {
    userId,
    videoUrl: null,
    videoPath: null,
    videoMimeType: null,
    frameUrl: null,
    framePath: null,
    frameTimeSec: null,
    submittedAt: null,
    creditsDeductedAt: null,
    evaluation: null,
  };
}

export function createEmptyDuoBattleState(hostUserId: string, guestUserId?: string | null): DuoBattleState {
  return {
    scene: null,
    hostSubmission: createEmptyDuoSubmission(hostUserId),
    guestSubmission: guestUserId ? createEmptyDuoSubmission(guestUserId) : null,
    result: null,
  };
}

export function createDuoRoomState(args: {
  roomId: string;
  inviteCode: string;
  host: Omit<DuoParticipant, "ready" | "readyAt" | "accessToken">;
  now?: string;
}): DuoRoomState {
  const now = args.now ?? new Date().toISOString();

  return {
    kind: "duo_room",
    version: 1,
    mode: "friend-battle",
    roomId: args.roomId,
    inviteCode: args.inviteCode,
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    host: {
      ...args.host,
      ready: false,
      readyAt: null,
      accessToken: null,
    },
    guest: null,
    battle: createEmptyDuoBattleState(args.host.userId),
  };
}

export function isDuoRoomState(value: unknown): value is DuoRoomState {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === "duo_room" &&
    record.version === 1 &&
    typeof record.roomId === "string" &&
    typeof record.inviteCode === "string" &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    typeof record.host === "object" &&
    record.host !== null
  );
}

export function normalizeDuoRoomState(room: DuoRoomState): DuoRoomState {
  const host = {
    ...room.host,
    accessToken: room.host.accessToken ?? null,
  };

  const guest = room.guest
    ? {
        ...room.guest,
        accessToken: room.guest.accessToken ?? null,
      }
    : null;

  const hostSubmission = room.battle?.hostSubmission?.userId === room.host.userId
    ? room.battle.hostSubmission
    : createEmptyDuoSubmission(room.host.userId);

  const guestSubmission = guest
    ? room.battle?.guestSubmission?.userId === guest.userId
      ? room.battle.guestSubmission
      : createEmptyDuoSubmission(guest.userId)
    : null;

  return {
    ...room,
    host,
    guest,
    battle: {
      scene: room.battle?.scene ?? null,
      hostSubmission,
      guestSubmission,
      result: room.battle?.result ?? null,
    },
  };
}

export function getDuoViewerRole(room: DuoRoomState, userId: string | null | undefined): DuoViewerRole {
  if (!userId) return "spectator";
  if (room.host.userId === userId) return "host";
  if (room.guest?.userId === userId) return "guest";
  return "spectator";
}

export function hasBothDuoParticipants(room: DuoRoomState) {
  return Boolean(room.host && room.guest);
}

export function canStartDuoRoom(room: DuoRoomState) {
  return Boolean(room.host.ready && room.guest?.ready) && room.status !== "live" && room.status !== "finished";
}

export function getDuoSubmissionByRole(room: DuoRoomState, role: DuoParticipantRole) {
  return role === "host" ? room.battle.hostSubmission : room.battle.guestSubmission;
}

export function setDuoSubmissionByRole(room: DuoRoomState, role: DuoParticipantRole, submission: DuoSubmission): DuoRoomState {
  return normalizeDuoRoomState({
    ...room,
    battle: {
      ...room.battle,
      hostSubmission: role === "host" ? submission : room.battle.hostSubmission,
      guestSubmission: role === "guest" ? submission : room.battle.guestSubmission,
    },
  });
}

export function calculateDuoTotalScore(scores: Partial<DuoScoreMap> | null | undefined) {
  const total = DUO_SCORE_LABELS.reduce((sum, label) => sum + (scores?.[label] ?? 0), 0);
  return Math.round(total / DUO_SCORE_LABELS.length);
}

export function buildDuoBattleResult(room: DuoRoomState, now = new Date().toISOString()): DuoBattleResult | null {
  const hostEvaluation = room.battle.hostSubmission?.evaluation;
  const guestEvaluation = room.battle.guestSubmission?.evaluation;
  if (!hostEvaluation || !guestEvaluation) return null;

  const hostTotalScore = hostEvaluation.totalScore;
  const guestTotalScore = guestEvaluation.totalScore;
  const diff = hostTotalScore - guestTotalScore;
  const sceneTitle = room.battle.scene?.title ?? "이번 배틀";

  if (Math.abs(diff) <= 1) {
    return {
      winnerRole: "draw",
      winnerUserId: null,
      hostTotalScore,
      guestTotalScore,
      summary: `${sceneTitle}에서 두 사람 모두 감정선을 비슷한 밀도로 가져갔어요. 이번 판은 거의 비등합니다.`,
      completedAt: now,
    };
  }

  const winnerRole: DuoParticipantRole = diff > 0 ? "host" : "guest";
  const winner = winnerRole === "host" ? room.host : room.guest;

  return {
    winnerRole,
    winnerUserId: winner?.userId ?? null,
    hostTotalScore,
    guestTotalScore,
    summary: `${winner?.nickname ?? "승자"} 쪽이 ${sceneTitle}의 핵심 감정을 더 선명하게 잡았어요. 표정의 방향과 몰입도가 한 단계 더 앞섰습니다.`,
    completedAt: now,
  };
}

export function withResolvedDuoRoomStatus(room: DuoRoomState, now = new Date().toISOString()): DuoRoomState {
  const normalized = normalizeDuoRoomState(room);
  const nextStatus: DuoRoomStatus = normalized.startedAt
    ? normalized.finishedAt
      ? "finished"
      : "live"
    : canStartDuoRoom(normalized)
      ? "ready"
      : "waiting";

  return {
    ...normalized,
    status: nextStatus,
    updatedAt: now,
  };
}

export function toPublicDuoRoomState(room: DuoRoomState): DuoRoomState {
  const normalized = normalizeDuoRoomState(room);
  return {
    ...normalized,
    host: {
      ...normalized.host,
      accessToken: null,
    },
    guest: normalized.guest
      ? {
          ...normalized.guest,
          accessToken: null,
        }
      : null,
  };
}

export function buildDuoRoomHref(roomId: string) {
  return `/audition/friend?room=${encodeURIComponent(roomId)}`;
}

export function buildDuoBattleHref(roomId: string) {
  return `/audition/friend/battle?room=${encodeURIComponent(roomId)}`;
}

export function buildDuoResultHref(roomId: string) {
  return `/audition/friend/result?room=${encodeURIComponent(roomId)}`;
}
