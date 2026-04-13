import type { SupabaseClient } from "@supabase/supabase-js";

export type GhostUserCandidate = {
  id: string;
  nickname: string | null;
  created_at: string | null;
  last_login_at: string | null;
};

type UserRow = GhostUserCandidate;
type UserIdRow = { user_id: string | null };
type UserEventRow = { user_id: string | null; event_type: string | null };
type CreditLotRow = { user_id: string | null; source_type: string | null };

const PAGE_SIZE = 1000;
const ALLOWED_GHOST_EVENT_TYPES = new Set(["login", "signup_bonus"]);
const ALLOWED_GHOST_CREDIT_SOURCES = new Set(["signup_bonus"]);

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw new Error(error.message ?? "데이터 조회 실패");
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function getGhostUserCandidates(supabase: SupabaseClient): Promise<GhostUserCandidate[]> {
  const [
    users,
    styleUsageRows,
    transformHistoryRows,
    auditionHistoryRows,
    paymentRows,
    userEventRows,
    creditLotRows,
  ] = await Promise.all([
    fetchAllRows<UserRow>(async (from, to) =>
      await supabase
        .from("users")
        .select("id, nickname, created_at, last_login_at")
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows<UserIdRow>(async (from, to) =>
      await supabase
        .from("style_usage")
        .select("user_id")
        .not("user_id", "is", null)
        .range(from, to)
    ),
    fetchAllRows<UserIdRow>(async (from, to) =>
      await supabase
        .from("transform_history")
        .select("user_id")
        .range(from, to)
    ),
    fetchAllRows<UserIdRow>(async (from, to) =>
      await supabase
        .from("audition_history")
        .select("user_id")
        .range(from, to)
    ),
    fetchAllRows<UserIdRow>(async (from, to) =>
      await supabase
        .from("payments")
        .select("user_id")
        .range(from, to)
    ),
    fetchAllRows<UserEventRow>(async (from, to) =>
      await supabase
        .from("user_events")
        .select("user_id, event_type")
        .range(from, to)
    ),
    fetchAllRows<CreditLotRow>(async (from, to) =>
      await supabase
        .from("credit_lots")
        .select("user_id, source_type")
        .range(from, to)
    ),
  ]);

  const styleUsageUsers = new Set(
    styleUsageRows
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
  const transformUsers = new Set(
    transformHistoryRows
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
  const auditionUsers = new Set(
    auditionHistoryRows
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
  const paymentUsers = new Set(
    paymentRows
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
  const meaningfulEventUsers = new Set(
    userEventRows
      .filter((row) => row.user_id && row.event_type && !ALLOWED_GHOST_EVENT_TYPES.has(row.event_type))
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
  const meaningfulCreditUsers = new Set(
    creditLotRows
      .filter((row) => row.user_id && row.source_type && !ALLOWED_GHOST_CREDIT_SOURCES.has(row.source_type))
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );

  return users.filter((user) => {
    const userId = user.id;
    return (
      !styleUsageUsers.has(userId) &&
      !transformUsers.has(userId) &&
      !auditionUsers.has(userId) &&
      !paymentUsers.has(userId) &&
      !meaningfulEventUsers.has(userId) &&
      !meaningfulCreditUsers.has(userId)
    );
  });
}

export async function deleteGhostUsers(supabase: SupabaseClient) {
  const candidates = await getGhostUserCandidates(supabase);
  const userIds = candidates.map((user) => user.id);

  if (userIds.length === 0) {
    return {
      deletedCount: 0,
      deletedUserIds: [] as string[],
      candidates,
    };
  }

  const deleteTargets: Array<{ table: string; column: string; ids: string[] }> = [
    { table: "payments", column: "user_id", ids: userIds },
    { table: "user_credits", column: "user_id", ids: userIds },
    { table: "credit_lots", column: "user_id", ids: userIds },
    { table: "generation_errors", column: "user_id", ids: userIds },
  ];

  for (const target of deleteTargets) {
    const { error } = await supabase.from(target.table).delete().in(target.column, target.ids);
    if (error) {
      throw new Error(`${target.table} 삭제 실패: ${error.message ?? "unknown error"}`);
    }
  }

  const { error: userDeleteError } = await supabase.from("users").delete().in("id", userIds);
  if (userDeleteError) {
    throw new Error(`users 삭제 실패: ${userDeleteError.message ?? "unknown error"}`);
  }

  return {
    deletedCount: userIds.length,
    deletedUserIds: userIds,
    candidates,
  };
}
