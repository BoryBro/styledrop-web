import { createClient } from "@supabase/supabase-js";

async function getStats() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from("style_usage")
    .select("style_id, style_name");

  if (error || !data) return { total: 0, byStyle: [] };

  const total = data.length;

  const counts: Record<string, { style_name: string; count: number }> = {};
  for (const row of data) {
    if (!counts[row.style_id]) {
      counts[row.style_id] = { style_name: row.style_name, count: 0 };
    }
    counts[row.style_id].count++;
  }

  const byStyle = Object.entries(counts).map(([style_id, v]) => ({
    style_id,
    style_name: v.style_name,
    count: v.count,
  }));

  return { total, byStyle };
}

export default async function AdminPage() {
  const { total, byStyle } = await getStats();

  return (
    <main className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold text-white">Admin</h1>

      {/* 전체 생성 수 */}
      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/10">
        <p className="text-white/40 text-sm font-medium mb-1">전체 생성 수</p>
        <p className="text-4xl font-extrabold text-white">{total}</p>
      </div>

      {/* 스타일별 사용 횟수 */}
      <div className="flex flex-col gap-3">
        <p className="text-white/40 text-sm font-medium px-1">스타일별 사용 횟수</p>
        {byStyle.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/10 text-white/30 text-sm">
            데이터 없음
          </div>
        ) : (
          byStyle.map((s) => (
            <div
              key={s.style_id}
              className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/10 flex items-center justify-between"
            >
              <span className="text-white font-semibold text-sm">{s.style_name}</span>
              <span className="text-[#C9571A] font-extrabold text-xl">{s.count}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
