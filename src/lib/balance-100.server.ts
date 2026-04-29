import "server-only";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  analyzeBalanceAnswers,
  getBalanceQuestions,
  normalizeBalanceQuestionCount,
  normalizeBalanceLevel,
  type BalanceAnswerValue,
  type BalanceAnswers,
  type BalanceLevel,
  type BalanceQuestionCount,
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
  questionCount: BalanceQuestionCount;
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
  questionCount: BalanceQuestionCount;
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
  questionCount: BalanceQuestionCount;
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

function sanitizeAnswers(answers: unknown, level: BalanceLevel, questionCount: BalanceQuestionCount = 100): BalanceAnswers {
  const questions = getBalanceQuestions(level, questionCount);
  const allowedIds = new Set(questions.map((question) => question.id));
  const source = answers && typeof answers === "object" ? answers as Record<string, unknown> : {};

  return Object.fromEntries(
    Object.entries(source)
      .filter(([questionId, value]) => allowedIds.has(questionId) && isAnswerValue(value)),
  ) as BalanceAnswers;
}

function sanitizeOwnerName(value: unknown, fallback: string) {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || fallback || "익명").slice(0, 16);
}

function buildResult(level: BalanceLevel, questionCount: BalanceQuestionCount, answers: BalanceAnswers) {
  const questions = getBalanceQuestions(level, questionCount);
  const completed = Object.keys(answers).length >= questions.length;
  return completed ? analyzeBalanceAnswers(answers, questions) : null;
}

function normalizeSessionSnapshot(value: unknown): Balance100SessionState | null {
  const snapshot = value as Partial<Balance100SessionState> | null;
  if (!snapshot?.sessionId || !snapshot.ownerUserId) return null;
  const level = normalizeBalanceLevel(snapshot.level);
  const questionCount = normalizeBalanceQuestionCount(snapshot.questionCount);
  const answers = sanitizeAnswers(snapshot.answers, level, questionCount);
  const now = new Date().toISOString();
  const rebuiltResult = buildResult(level, questionCount, answers);
  const result = snapshot.result?.resultStory
    ? snapshot.result
    : rebuiltResult ?? snapshot.result ?? null;

  return {
    sessionId: String(snapshot.sessionId),
    ownerUserId: String(snapshot.ownerUserId),
    ownerName: String(snapshot.ownerName ?? "익명"),
    level,
    questionCount,
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
  const current = sessions.find((session) => session.status === "in_progress") ?? null;
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

  const openSessions = sessions.filter((session) => session.status === "in_progress");
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
  questionCount?: BalanceQuestionCount;
  restart?: boolean;
  source?: Balance100SessionSource;
  answers?: BalanceAnswers;
  ownerName?: string;
}) {
  if (input.restart) {
    await closeOpenBalance100Sessions(input.user.id);
  } else {
    const current = await getCurrentBalance100Session(input.user.id);
    if (current.session) return { session: current.session, error: null, reused: true };
  }

  const now = new Date().toISOString();
  const questionCount = normalizeBalanceQuestionCount(input.questionCount);
  const answers = sanitizeAnswers(input.answers ?? {}, input.level, questionCount);
  const result = buildResult(input.level, questionCount, answers);
  const session: Balance100SessionState = {
    sessionId: randomId(8),
    ownerUserId: input.user.id,
    ownerName: sanitizeOwnerName(input.ownerName, input.user.nickname),
    level: input.level,
    questionCount,
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
  ownerName?: string;
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
    ? sanitizeAnswers(input.answers, current.session.level, current.session.questionCount)
    : current.session.answers;
  const result = buildResult(current.session.level, current.session.questionCount, answers);
  const now = new Date().toISOString();
  const nextSession: Balance100SessionState = {
    ...current.session,
    ownerName:
      typeof input.ownerName === "string"
        ? sanitizeOwnerName(input.ownerName, current.session.ownerName || input.user.nickname)
        : current.session.ownerName,
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

export async function discardBalance100Session(input: {
  sessionId: string;
  user: AppSession;
}) {
  const current = await getBalance100Session(input.sessionId);
  if (current.error || !current.session) {
    return { ok: false, error: current.error ?? "session not found" };
  }
  if (current.session.ownerUserId !== input.user.id) {
    return { ok: false, error: "권한이 없습니다." };
  }
  if (current.session.status === "closed") {
    return { ok: true, error: null };
  }

  const saved = await saveBalance100Session({
    ...current.session,
    status: "closed",
    updatedAt: new Date().toISOString(),
    version: current.session.version + 1,
  });

  return { ok: saved.ok, error: saved.error };
}

export async function createBalance100PredictionLink(input: {
  sessionId: string;
  user: AppSession;
  ownerName?: string;
}) {
  const current = await getBalance100Session(input.sessionId);
  if (current.error || !current.session) {
    return { session: null, path: null, error: current.error ?? "session not found" };
  }
  if (current.session.ownerUserId !== input.user.id) {
    return { session: null, path: null, error: "권한이 없습니다." };
  }
  if (!current.session.result) {
    return { session: null, path: null, error: "문항을 모두 완료한 뒤 만들 수 있습니다." };
  }

  const token = current.session.predictionToken ?? randomId(12);
  const nextSession: Balance100SessionState = {
    ...current.session,
    ownerName:
      typeof input.ownerName === "string"
        ? sanitizeOwnerName(input.ownerName, current.session.ownerName || input.user.nickname)
        : current.session.ownerName,
    predictionToken: token,
    updatedAt: new Date().toISOString(),
    version: current.session.version + 1,
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
      tierTitle: "거의 같은 사람",
      tierDesc: "고른 선택이 거의 같습니다. 서로의 기준이 꽤 비슷하게 움직였어요.",
    };
  }
  if (percent >= 81) {
    return {
      tierTitle: "생각보다 잘 맞는 사이",
      tierDesc: "큰 방향이 많이 비슷합니다. 몇 개의 취향 차이만 남아 있어요.",
    };
  }
  if (percent >= 61) {
    return {
      tierTitle: "비슷한 구석이 많은 사이",
      tierDesc: "완전히 같지는 않지만, 선택 기준이 겹치는 부분이 꽤 있습니다.",
    };
  }
  if (percent >= 41) {
    return {
      tierTitle: "은근히 다른 사이",
      tierDesc: "겉으로는 비슷해 보여도 실제 선택 기준은 꽤 다릅니다.",
    };
  }
  return {
    tierTitle: "정반대 취향",
    tierDesc: "같은 질문을 봐도 선택 기준이 꽤 다른 방향으로 움직입니다.",
  };
}

function compareAnswers(source: BalanceAnswers, guess: BalanceAnswers, level: BalanceLevel, questionCount: BalanceQuestionCount) {
  const questions = getBalanceQuestions(level, questionCount);
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
  predictorName?: string;
}) {
  const source = await getBalance100SessionByPredictionToken(input.token);
  if (source.error || !source.session) {
    return { prediction: null, sourceSession: null, error: "공유 링크를 찾을 수 없습니다." };
  }
  if (!source.session.result) {
    return { prediction: null, sourceSession: source.session, error: "아직 완료되지 않은 링크입니다." };
  }
  if (source.session.ownerUserId === input.user.id) {
    return { prediction: null, sourceSession: source.session, error: "내가 만든 링크는 친구에게 보내는 용도입니다." };
  }

  const answers = sanitizeAnswers(input.answers, source.session.level, source.session.questionCount);
  if (Object.keys(answers).length < source.session.questionCount) {
    return { prediction: null, sourceSession: source.session, error: `${source.session.questionCount}문항을 모두 답해야 합니다.` };
  }

  const { matchedCount, percent } = compareAnswers(source.session.answers, answers, source.session.level, source.session.questionCount);
  const tier = getPredictionTier(percent);
  const completedSession = await createBalance100Session({
    user: input.user,
    level: source.session.level,
    questionCount: source.session.questionCount,
    restart: true,
    source: "prediction",
    answers,
    ownerName: input.predictorName,
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
    predictorName: sanitizeOwnerName(input.predictorName, input.user.nickname),
    level: source.session.level,
    questionCount: source.session.questionCount,
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
  if (!input.session.result) return { matches: [] as Balance100MatchItem[], error: null };

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
      session.questionCount === input.session.questionCount &&
      Boolean(session.result) &&
      isWithinLabHistoryRetention(session.updatedAt),
    );
  const latestByUser = new Map<string, Balance100SessionState>();
  for (const session of completed.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))) {
    if (!latestByUser.has(session.ownerUserId)) {
      latestByUser.set(session.ownerUserId, session);
    }
  }

  const matches = [...latestByUser.values()]
    .map((session) => {
      const compared = compareAnswers(input.session.answers, session.answers, input.session.level, input.session.questionCount);
      return {
        sessionId: session.sessionId,
        ownerName: session.ownerName,
        level: session.level,
        questionCount: session.questionCount,
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
