import "server-only";

import { createClient } from "@supabase/supabase-js";
import { STYLE_LABELS } from "@/lib/styles";

export type GenerationErrorLogInput = {
  styleId: string;
  variant?: string | null;
  userId?: string | null;
  errorType: string;
  message?: string | null;
  finishReason?: string | null;
};

export type RecentGenerationError = {
  id: number;
  style_id: string;
  style_name: string;
  variant: string | null;
  error_type: string;
  message: string | null;
  finish_reason: string | null;
  created_at: string;
  latestSuccessAt: string | null;
  isResolved: boolean;
};

export type GenerationErrorSummary = {
  style_id: string;
  style_name: string;
  errorCount: number;
  successCount24h: number;
  errorRate: number;
  topErrorType: string;
  lastErrorAt: string;
  latestSuccessAt: string | null;
  isResolved: boolean;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "42P01" || maybe.message?.includes("generation_errors") === true;
}

export async function logGenerationError(input: GenerationErrorLogInput) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("generation_errors").insert({
      style_id: input.styleId,
      variant: input.variant ?? "default",
      user_id: input.userId ?? null,
      error_type: input.errorType,
      message: input.message ?? null,
      finish_reason: input.finishReason ?? null,
    });

    if (error && !isMissingTableError(error)) {
      console.error("[generation-errors] insert error:", error);
    }
  } catch (error) {
    console.error("[generation-errors] unexpected error:", error);
  }
}

export async function getGenerationErrorOverview() {
  const since24h = new Date(Date.now() - 24 * 3600000).toISOString();

  try {
    const supabase = getSupabase();
    const [recentRes, last24hErrorRes, last24hSuccessRes] = await Promise.all([
      supabase
        .from("generation_errors")
        .select("id, style_id, variant, error_type, message, finish_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("generation_errors")
        .select("style_id, error_type, created_at")
        .gte("created_at", since24h),
      supabase
        .from("style_usage")
        .select("style_id")
        .gte("created_at", since24h),
    ]);

    if (recentRes.error || last24hErrorRes.error) {
      if (isMissingTableError(recentRes.error) || isMissingTableError(last24hErrorRes.error)) {
        return {
          generationErrorTotal24h: 0,
          generationErrorSummary: [] as GenerationErrorSummary[],
          recentGenerationErrors: [] as RecentGenerationError[],
        };
      }
      throw recentRes.error || last24hErrorRes.error;
    }

    const recentRows = recentRes.data ?? [];
    const last24hErrorRows = last24hErrorRes.data ?? [];
    const successCounts: Record<string, number> = {};
    for (const row of last24hSuccessRes.data ?? []) {
      successCounts[row.style_id] = (successCounts[row.style_id] ?? 0) + 1;
    }

    const relevantErrorRows = [...recentRows, ...last24hErrorRows];
    const relevantStyleIds = Array.from(
      new Set(
        relevantErrorRows
          .map((row) => row.style_id)
          .filter((styleId): styleId is string => typeof styleId === "string" && styleId.length > 0)
      )
    );

    const latestSuccessByStyle = new Map<string, string>();

    if (relevantStyleIds.length > 0 && relevantErrorRows.length > 0) {
      const oldestRelevantErrorAt = relevantErrorRows.reduce((oldest, row) => (
        row.created_at < oldest ? row.created_at : oldest
      ), relevantErrorRows[0].created_at);

      const successAfterErrorRes = await supabase
        .from("style_usage")
        .select("style_id, created_at")
        .in("style_id", relevantStyleIds)
        .gte("created_at", oldestRelevantErrorAt)
        .order("created_at", { ascending: false })
        .limit(10000);

      if (successAfterErrorRes.error) {
        throw successAfterErrorRes.error;
      }

      for (const row of successAfterErrorRes.data ?? []) {
        if (!latestSuccessByStyle.has(row.style_id)) {
          latestSuccessByStyle.set(row.style_id, row.created_at);
        }
      }
    }

    const summaryMap = new Map<string, {
      errorCount: number;
      lastErrorAt: string;
      typeCounts: Record<string, number>;
    }>();

    for (const row of last24hErrorRes.data ?? []) {
      const errorType = String(row.error_type ?? "unknown");
      const current = summaryMap.get(row.style_id) ?? {
        errorCount: 0,
        lastErrorAt: row.created_at,
        typeCounts: {} as Record<string, number>,
      };
      current.errorCount += 1;
      current.lastErrorAt = current.lastErrorAt > row.created_at ? current.lastErrorAt : row.created_at;
      current.typeCounts[errorType] = (current.typeCounts[errorType] ?? 0) + 1;
      summaryMap.set(row.style_id, current);
    }

    const generationErrorSummary: GenerationErrorSummary[] = Array.from(summaryMap.entries())
      .map(([styleId, value]) => {
        const successCount24h = successCounts[styleId] ?? 0;
        const totalAttempts = successCount24h + value.errorCount;
        const topErrorType = Object.entries(value.typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
        const latestSuccessAt = latestSuccessByStyle.get(styleId) ?? null;
        const isResolved = latestSuccessAt ? latestSuccessAt > value.lastErrorAt : false;
        return {
          style_id: styleId,
          style_name: STYLE_LABELS[styleId] ?? styleId,
          errorCount: value.errorCount,
          successCount24h,
          errorRate: totalAttempts > 0 ? Math.round((value.errorCount / totalAttempts) * 100) : 0,
          topErrorType,
          lastErrorAt: value.lastErrorAt,
          latestSuccessAt,
          isResolved,
        };
      })
      .sort((a, b) => {
        if (Number(a.isResolved) !== Number(b.isResolved)) {
          return Number(a.isResolved) - Number(b.isResolved);
        }
        if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
        return a.style_name.localeCompare(b.style_name, "ko");
      });

    const recentGenerationErrors: RecentGenerationError[] = recentRows.map((row) => {
      const latestSuccessAt = latestSuccessByStyle.get(row.style_id) ?? null;
      const isResolved = latestSuccessAt ? latestSuccessAt > row.created_at : false;
      return {
        ...row,
        style_name: STYLE_LABELS[row.style_id] ?? row.style_id,
        latestSuccessAt,
        isResolved,
      };
    });

    return {
      generationErrorTotal24h: (last24hErrorRes.data ?? []).length,
      generationErrorSummary,
      recentGenerationErrors,
    };
  } catch (error) {
    console.error("[generation-errors] overview error:", error);
    return {
      generationErrorTotal24h: 0,
      generationErrorSummary: [] as GenerationErrorSummary[],
      recentGenerationErrors: [] as RecentGenerationError[],
    };
  }
}
