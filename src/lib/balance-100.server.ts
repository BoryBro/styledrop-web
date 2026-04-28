import "server-only";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  BALANCE_TOTAL_QUESTIONS,
  analyzeBalanceAnswers,
  getBalanceQuestions,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceLevel,
  type BalanceResultSummary,
} from "@/lib/balance-100";
import type { AppSession } from "@/lib/auth-session";
import { isWithinLabHistoryRetention } from "@/lib/lab-history-retention.server";

const SESSION_EVENT_TYPE = "lab_balance_session_state";
const PREDICTION_EVENT_TYPE = "lab_balance_prediction_state";

export type Balance100SessionStatus = "in_progress" | "completed" | "closed";
export type Balance100SessionSource = "direct" | "prediction";

export type Balance100SessionState = {
  sessionId: string;
  ownerUserId: string;
  ownerName: string;
  level: BalanceLevel;
  answers: BalanceAnswers;
  status: Balance100SessionStatus;
  result: BalanceResultSummary | null;
  representativeImageUrl?: string;
  predictionToken?: string;
  source: Balance100SessionSource;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  version: number;
};

export type Balance100MatchItem = {
  sessionId: string;
  ownerName: string;
  level: BalanceLevel;
  matchedCount: number;
  percent: number;
  typeTitle: string;
  updatedAt: string;
};

export type Balance100PredictionState = {
  predictionId: string;
  token: string;
  sourceSessionId: string;
  sourceOwnerUserId: string;
  sourceOwnerName: string;
  predictorUserId: string;
  predictorName: string;
  level: BalanceLevel;
  answers: BalanceAnswers;
  matchedCount: number;
  percent: number;
  tierTitle: string;
  tierDesc: string;
  reverseSharePath: string | null;
  createdAt: string;
  completedAt: string;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function randomId(size = 12) {
  return randomBytes(size).toString("hex");
}

function toTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function latestByTime<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = toTime(a.updatedAt ?? a.createdAt);
    const bTime = toTime(b.updatedAt ?? b.createdAt);
    return bTime - aTime;
  })[0] ?? null;
}

function isAnswerValue(value: unknown): value is BalanceAnswerValue {
  return value === "A" || value === "B";
}

function sanitizeAnswers(answers: unknown, level: BalanceLevel): BalanceAnswers {
  const questions = getBalanceQuestions(level);
  const allowedIds = new Set(questions.map((question) => question.id));
  const source = answers && typeof answers === "object" ? answers as Record<string, unknown> : {};

  return Object.fromEntries(
    Object.entries(source)
      .filter(([questionId, value]) => allowedIds.has(questionId) && isAnswerValue(value)),
  ) as BalanceAnswers;
}

function buildResult(level: BalanceLevel, answers: BalanceAnswers) {
  const questions = getBalanceQuestions(level);
  const completed = Object.keys(answers).length >= questions.length;
  return completed ? analyzeBalanceAnswers(answers, questions) : null;
}

function normalizeSessionSnapshot(value: unknown): Balance100SessionState | null {
  const snapshot = value as Partial<Balance100SessionState> | null;
  if (!snapshot?.sessionId || !snapshot.ownerUserId) return null;
  const level = normalizeBalanceLevel(snapshot.level);
  const answers = sanitizeAnswers(snapshot.answers, level);
  const now = new Date().toISOString();
  const result = snapshot.result ?? buildResult(level, answers);

  return {
    sessionId: String(snapshot.sessionId),
    ownerUserId: String(snapshot.ownerUserId),
    ownerName: String(snapshot.ownerName ?? "익명"),
    level,
    answers,
    status:
      snapshot.status === "completed" || snapshot.status === "closed"
        ? snapshot.status
        : result
          ? "completed"
          : "in_progress",
    result,
    representativeImageUrl:
      typeof snapshot.representativeImageUrl === "string"
        ? snapshot.representativeImageUrl
        : undefined,
    predictionToken:
      typeof snapshot.predictionToken === "string"
        ? snapshot.predictionToken
        : undefined,
    source: snapshot.source === "prediction" ? "prediction" : "direct",
    createdAt: typeof snapshot.createdAt === "string" ? snapshot.createdAt : now,
    updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : now,
    completedAt:
      typeof snapshot.completedAt === "string"
        ? snapshot.completedAt
        : result
          ? now
          : null,
    version: Number.isFinite(snapshot.version) ? Number(snapshot.version) : 1,
  };
}

function mergeSessionSnapshots(snapshots: Balance100SessionState[]) {
  return latestByTime(snapshots);
}

async function saveBalance100Session(session: Balance100SessionState) {
  const supabase = getSupabase();
  const { error } = await supabase.from("user_events").insert({
    user_id: session.ownerUserId,
    event_type: SESSION_EVENT_TYPE,
    metadata: session,
  });

  return { ok: !error, error: error?.message ?? null };
}

async function querySessionSnapshotsByUser(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", SESSION_EVENT_TYPE)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return { sessions: [] as Balance100SessionState[], error: error.message };

  const snapshots = (data ?? [])
    .map((entry) => normalizeSessionSnapshot(entry.metadata))
    .filter((entry): entry is Balance100SessionState => Boolean(entry));
  const grouped = new Map<string, Balance100SessionState[]>();

  for (const snapshot of snapshots) {
    grouped.set(snapshot.sessionId, [...(grouped.get(snapshot.sessionId) ?? []), snapshot]);
  }

  return {
    sessions: [...grouped.values()]
      .map(mergeSessionSnapshots)
      .filter((entry): entry is Balance100SessionState => Boolean(entry))
      .filter((entry) => isWithinLabHistoryRetention(entry.updatedAt))
      .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt)),
    error: null,
  };
}

export async function listBalance100SessionsForUser(userId: string) {
  return querySessionSnapshotsByUser(userId);
}

export async function getCurrentBalance100Session(userId: string) {
  const { sessions, error } = await querySessionSnapshotsByUser(userId);
  if (error) return { session: null, error };
  const current = sessions.find((session) => session.status !== "closed") ?? null;
  return { session: current, error: null };
}

export async function getBalance100Session(sessionId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", SESSION_EVENT_TYPE)
    .contains("metadata", { sessionId })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { session: null, error: error.message };

  const snapshots = (data ?? [])
    .map((entry) => normalizeSessionSnapshot(entry.metadata))
    .filter((entry): entry is Balance100SessionState => Boolean(entry));
  const session = mergeSessionSnapshots(snapshots);
  return {
    session: session && isWithinLabHistoryRetention(session.updatedAt) ? session : null,
    error: null,
  };
}

export async function closeOpenBalance100Sessions(userId: string) {
  const { sessions, error } = await querySessionSnapshotsByUser(userId);
  if (error) return { ok: false, error };

  const openSessions = sessions.filter((session) => session.status !== "closed");
  for (const session of openSessions) {
    await saveBalance100Session({
      ...session,
      status: "closed",
      updatedAt: new Date().toISOString(),
      version: session.version + 1,
    });
  }

  return { ok: true, error: null };
}

export async function createBalance100Session(input: {
  user: AppSession;
  level: BalanceLevel;
  restart?: boolean;
  source?: Balance100SessionSource;
  answers?: BalanceAnswers;
}) {
  if (input.restart) {
    await closeOpenBalance100Sessions(input.user.id);
  } else {
    const current = await getCurrentBalance100Session(input.user.id);
    if (current.session) return { session: current.session, error: null, reused: true };
  }

  const now = new Date().toISOString();
  const answers = sanitizeAnswers(input.answers ?? {}, input.level);
  const result = buildResult(input.level, answers);
  const session: Balance100SessionState = {
    sessionId: randomId(8),
    ownerUserId: input.user.id,
    ownerName: input.user.nickname || "익명",
    level: input.level,
    answers,
    status: result ? "completed" : "in_progress",
    result,
    source: input.source ?? "direct",
    createdAt: now,
    updatedAt: now,
    completedAt: result ? now : null,
    version: 1,
  };

  const saved = await saveBalance100Session(session);
  if (!saved.ok) return { session: null, error: saved.error, reused: false };
  return { session, error: null, reused: false };
}

export async function updateBalance100Session(input: {
  sessionId: string;
  user: AppSession;
  answers?: BalanceAnswers;
  representativeImageUrl?: string;
}) {
  const current = await getBalance100Session(input.sessionId);
  if (current.error || !current.session) {
    return { session: null, error: current.error ?? "session not found" };
  }
  if (current.session.ownerUserId !== input.user.id) {
    return { session: null, error: "권한이 없습니다." };
  }
  if (current.session.status === "closed") {
    return { session: null, error: "이미 종료된 세션입니다." };
  }

  const answers = input.answers
    ? sanitizeAnswers(input.answers, current.session.level)
    : current.session.answers;
  const result = buildResult(current.session.level, answers);
  const now = new Date().toISOString();
  const nextSession: Balance100SessionState = {
    ...current.session,
    answers,
    result,
    status: result ? "completed" : "in_progress",
    representativeImageUrl:
      input.representativeImageUrl ?? current.session.representativeImageUrl,
    updatedAt: now,
    completedAt: result ? current.session.completedAt ?? now : null,
    version: current.session.version + 1,
  };

  const saved = await saveBalance100Session(nextSession);
  if (!saved.ok) return { session: null, error: saved.error };
  return { session: nextSession, error: null };
}

export async function createBalance100PredictionLink(input: {
  sessionId: string;
  user: AppSession;
}) {
  const current = await getBalance100Session(input.sessionId);
  if (current.error || !current.session) {
    return { session: null, path: null, error: current.error ?? "session not found" };
  }
  if (current.session.ownerUserId !== input.user.id) {
    return { session: null, path: null, error: "권한이 없습니다." };
  }
  if (current.session.status !== "completed" || !current.session.result) {
    return { session: null, path: null, error: "100문항을 완료한 뒤 만들 수 있습니다." };
  }

  const token = current.session.predictionToken ?? randomId(12);
  const updated = await updateBalance100Session({
    sessionId: input.sessionId,
    user: input.user,
    answers: current.session.answers,
  });

  if (updated.error || !updated.session) {
    return { session: null, path: null, error: updated.error ?? "링크 생성 실패" };
  }

  const nextSession: Balance100SessionState = {
    ...updated.session,
    predictionToken: token,
    updatedAt: new Date().toISOString(),
    version: updated.session.version + 1,
  };
  const saved = await saveBalance100Session(nextSession);
  if (!saved.ok) return { session: null, path: null, error: saved.error };

  return {
    session: nextSession,
    path: `/balance-100/share?token=${encodeURIComponent(token)}`,
    error: null,
  };
}

export async function getBalance100SessionByPredictionToken(token: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", SESSION_EVENT_TYPE)
    .contains("metadata", { predictionToken: token })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { session: null, error: error.message };
  const snapshots = (data ?? [])
    .map((entry) => normalizeSessionSnapshot(entry.metadata))
    .filter((entry): entry is Balance100SessionState => Boolean(entry));
  const session = mergeSessionSnapshots(snapshots);
  return {
    session: session && isWithinLabHistoryRetention(session.updatedAt) ? session : null,
    error: null,
  };
}

function getPredictionTier(percent: number) {
  if (percent >= 96) {
    return {
      tierTitle: "거의 복사본",
      tierDesc: "이 정도면 답을 훔쳐본 수준입니다. 서로의 기준을 꽤 정확하게 읽었어요.",
    };
  }
  if (percent >= 81) {
    return {
      tierTitle: "상당히 잘 아는 사이",
      tierDesc: "큰 방향은 거의 맞췄습니다. 몇 개의 취향 차이만 남아 있어요.",
    };
  }
  if (percent >= 61) {
    return {
      tierTitle: "꽤 읽히는 사이",
      tierDesc: "대충 안다고 말하기엔 근거가 있습니다. 다만 핵심 선택 몇 개에서 갈렸어요.",
    };
  }
  if (percent >= 41) {
    return {
      tierTitle: "은근히 다른 사이",
      tierDesc: "겉으로는 비슷해 보여도 실제 선택 기준은 꽤 다릅니다.",
    };
  }
  return {
    tierTitle: "다른 행성 출신",
    tierDesc: "서로를 안다고 생각했지만, 밸런스 기준은 거의 다른 방향으로 갑니다.",
  };
}

function compareAnswers(source: BalanceAnswers, guess: BalanceAnswers, level: BalanceLevel) {
  const questions = getBalanceQuestions(level);
  const matchedCount = questions.reduce((count, question) => (
    source[question.id] && source[question.id] === guess[question.id] ? count + 1 : count
  ), 0);
  const percent = Math.round((matchedCount / questions.length) * 100);
  return { matchedCount, percent };
}

async function savePrediction(prediction: Balance100PredictionState) {
  const supabase = getSupabase();
  const { error } = await supabase.from("user_events").insert({
    user_id: prediction.predictorUserId,
    event_type: PREDICTION_EVENT_TYPE,
    metadata: prediction,
  });

  return { ok: !error, error: error?.message ?? null };
}

export async function submitBalance100Prediction(input: {
  token: string;
  user: AppSession;
  answers: BalanceAnswers;
}) {
  const source = await getBalance100SessionByPredictionToken(input.token);
  if (source.error || !source.session) {
    return { prediction: null, sourceSession: null, error: "예측 링크를 찾을 수 없습니다." };
  }
  if (source.session.status !== "completed") {
    return { prediction: null, sourceSession: source.session, error: "아직 완료되지 않은 링크입니다." };
  }
  if (source.session.ownerUserId === input.user.id) {
    return { prediction: null, sourceSession: source.session, error: "내 링크로는 예측할 수 없습니다." };
  }

  const answers = sanitizeAnswers(input.answers, source.session.level);
  if (Object.keys(answers).length < BALANCE_TOTAL_QUESTIONS) {
    return { prediction: null, sourceSession: source.session, error: "100문항을 모두 답해야 합니다." };
  }

  const { matchedCount, percent } = compareAnswers(source.session.answers, answers, source.session.level);
  const tier = getPredictionTier(percent);
  const completedSession = await createBalance100Session({
    user: input.user,
    level: source.session.level,
    restart: true,
    source: "prediction",
    answers,
  });

  let reverseSharePath: string | null = null;
  if (completedSession.session) {
    const reverse = await createBalance100PredictionLink({
      sessionId: completedSession.session.sessionId,
      user: input.user,
    });
    reverseSharePath = reverse.path;
  }

  const now = new Date().toISOString();
  const prediction: Balance100PredictionState = {
    predictionId: randomId(8),
    token: input.token,
    sourceSessionId: source.session.sessionId,
    sourceOwnerUserId: source.session.ownerUserId,
    sourceOwnerName: source.session.ownerName,
    predictorUserId: input.user.id,
    predictorName: input.user.nickname || "익명",
    level: source.session.level,
    answers,
    matchedCount,
    percent,
    tierTitle: tier.tierTitle,
    tierDesc: tier.tierDesc,
    reverseSharePath,
    createdAt: now,
    completedAt: now,
  };

  const saved = await savePrediction(prediction);
  if (!saved.ok) {
    return { prediction: null, sourceSession: source.session, error: saved.error };
  }

  return { prediction, sourceSession: source.session, error: null };
}

export async function findBalance100Matches(input: {
  session: Balance100SessionState;
  limit?: number;
}) {
  if (input.session.status !== "completed") return { matches: [] as Balance100MatchItem[], error: null };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_events")
    .select("metadata, created_at")
    .eq("event_type", SESSION_EVENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1200);

  if (error) return { matches: [] as Balance100MatchItem[], error: error.message };

  const snapshots = (data ?? [])
    .map((entry) => normalizeSessionSnapshot(entry.metadata))
    .filter((entry): entry is Balance100SessionState => Boolean(entry));
  const grouped = new Map<string, Balance100SessionState[]>();

  for (const snapshot of snapshots) {
    grouped.set(snapshot.sessionId, [...(grouped.get(snapshot.sessionId) ?? []), snapshot]);
  }

  const completed = [...grouped.values()]
    .map(mergeSessionSnapshots)
    .filter((session): session is Balance100SessionState => Boolean(session))
    .filter((session) =>
      session.sessionId !== input.session.sessionId &&
      session.ownerUserId !== input.session.ownerUserId &&
      session.level === input.session.level &&
      session.status === "completed" &&
      Boolean(session.result) &&
      isWithinLabHistoryRetention(session.updatedAt),
    );

  const matches = completed
    .map((session) => {
      const compared = compareAnswers(input.session.answers, session.answers, input.session.level);
      return {
        sessionId: session.sessionId,
        ownerName: session.ownerName,
        level: session.level,
        matchedCount: compared.matchedCount,
        percent: compared.percent,
        typeTitle: session.result?.typeTitle ?? "결과 완료",
        updatedAt: session.updatedAt,
      };
    })
    .sort((a, b) => b.matchedCount - a.matchedCount || toTime(b.updatedAt) - toTime(a.updatedAt))
    .slice(0, input.limit ?? 5);

  return { matches, error: null };
}
