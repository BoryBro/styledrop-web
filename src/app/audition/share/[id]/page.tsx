import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";

type Scores = { 이해도: number; 표정연기: number; 창의성: number; 몰입도: number };
type SceneResult = { genre: string; critique: string; assigned_role: string; scores: Scores };
type AuditionResult = { scenes: SceneResult[]; overall_critique: string; overall_one_liner?: string };
type GenreMeta = { genre: string; cue: string };

const GENRE_EMOJIS: Record<string, string> = {
  멜로: "💔", 스릴러: "🔪", 일상: "😐", 공포: "👻", 코미디: "😂", 액션: "💥",
  판타지: "✨", 범죄: "🕵️", 로맨스: "🌹", 심리: "🧠",
};

const SCORE_LABELS = ["이해도", "표정연기", "창의성", "몰입도"] as const;

function scoreColor(v: number) {
  if (v >= 70) return "#4ade80";
  if (v >= 45) return "#f97316";
  return "#ef4444";
}

async function getShare(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  const { data } = await supabase
    .from("audition_shares")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export default async function AuditionSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();

  const result: AuditionResult = share.result_json;
  const genres: GenreMeta[] = share.genres_json ?? [];
  const bestIdx: number = share.best_scene_idx ?? 0;
  const userPhotoUrl: string | null = share.user_photo_url;
  const stillImageUrl: string | null = share.still_image_url;
  const bestScene = result.scenes[bestIdx];

  const avgScore = Math.round(
    result.scenes.reduce((sum, s) => {
      const vals = SCORE_LABELS.map(l => s.scores?.[l] ?? 0);
      return sum + vals.reduce((a, b) => a + b, 0) / vals.length;
    }, 0) / result.scenes.length
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
        <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        <span className="text-[11px] text-[#444] font-bold uppercase tracking-widest">AI 오디션 결과</span>
      </header>

      <main className="flex-1 max-w-sm mx-auto w-full px-4 py-6 flex flex-col gap-4 pb-36">

        {/* 타이틀 */}
        <div className="text-center mb-1">
          <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-1">친구의 오디션 결과</p>
          <h1 className="text-[22px] font-extrabold text-white">AI 오디션</h1>
        </div>

        {/* 스틸컷 full + 촬영컷 PIP 좌측하단 */}
        {(userPhotoUrl || stillImageUrl) && (
          <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-[#C9571A]/30 bg-[#111]">
            {stillImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stillImageUrl} alt="AI 스틸컷" className="w-full h-full object-cover" />
            ) : userPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhotoUrl} alt="오디션 사진" className="w-full h-full object-cover" />
            ) : null}
            {/* 촬영컷 PIP */}
            {userPhotoUrl && stillImageUrl && (
              <div className="absolute bottom-3 left-3 w-[80px] h-[80px] rounded-xl overflow-hidden border-2 border-white/50 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={userPhotoUrl} alt="내 연기" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <span className="text-[10px] font-bold text-[#C9571A]">🏆 BEST SCENE · {GENRE_EMOJIS[bestScene?.genre] ?? "🎬"} {bestScene?.genre}</span>
            </div>
          </div>
        )}

        {/* 배정 단역 (좌) + 종합점수 (우) */}
        <div className="flex items-center bg-[#111] border border-white/10 rounded-2xl px-4 py-4 gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold text-[#555] uppercase tracking-widest mb-1.5">배정 단역</p>
            <p className="font-black text-[#ef4444] leading-tight"
              style={{ fontSize: "clamp(15px, 5vw, 22px)", fontStyle: "italic",
                textShadow: "0 0 20px rgba(239,68,68,0.4)", letterSpacing: "-0.02em" }}>
              {bestScene?.assigned_role}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-[#555] font-bold uppercase tracking-widest mb-0.5">종합점수</p>
            <p className="font-black leading-none" style={{ fontSize: "48px", color: scoreColor(avgScore) }}>
              {avgScore}
            </p>
            <p className="text-[10px] font-bold" style={{ color: avgScore >= 70 ? "#4ade80" : avgScore >= 45 ? "#f97316" : "#ef4444" }}>
              {avgScore >= 70 ? "✓ 합격권" : avgScore >= 45 ? "△ 보류" : "✗ 불합격"}
            </p>
          </div>
        </div>

        {/* 감독 총평 (one-liner + 상세 총평 병합) */}
        <div className="border border-[#C9571A]/30 rounded-xl px-4 py-5 bg-[#C9571A]/5">
          <p className="text-[11px] font-bold text-[#C9571A] uppercase tracking-widest mb-3">🎬 감독 총평</p>
          {result.overall_one_liner && (
            <p className="text-white font-extrabold leading-snug mb-4"
              style={{ fontSize: "clamp(17px, 5vw, 22px)" }}>
              {result.overall_one_liner}
            </p>
          )}
          <div className="border-t border-white/10 pt-4">
            <p className="text-white/80 text-[15px] leading-[1.9]">{result.overall_critique}</p>
          </div>
        </div>

        {/* 장르별 씬 */}
        <div className="flex flex-col gap-3">
          {result.scenes.map((scene, i) => {
            const avg = Math.round(SCORE_LABELS.reduce((s, l) => s + (scene.scores?.[l] ?? 0), 0) / 4);
            return (
              <div key={i} className="bg-[#111] border border-white/8 rounded-2xl px-4 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{GENRE_EMOJIS[scene.genre] ?? "🎬"}</span>
                    <span className="text-[12px] font-bold text-[#C9571A] tracking-wide">{scene.genre}</span>
                  </div>
                  <span className="text-[20px] font-extrabold" style={{ color: scoreColor(avg) }}>{avg}점</span>
                </div>
                {genres[i]?.cue && (
                  <div className="bg-black/40 border-l-[3px] border-[#C9571A] rounded-r-lg px-3 py-2 mb-3">
                    <p className="text-[10px] text-[#666] mb-1 uppercase tracking-widest">지시 상황</p>
                    <p className="text-white/80 text-[13px] leading-snug">{genres[i].cue}</p>
                  </div>
                )}
                {/* 비평 3줄 제한 */}
                <p className="text-white/85 text-[14px] leading-[1.85] overflow-hidden"
                  style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                  {scene.critique}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-[#111] border border-[#C9571A]/20 rounded-2xl px-5 py-5 text-center">
          <p className="text-[13px] text-[#888] mb-1">나도 AI 감독한테 심사받아볼까?</p>
          <p className="text-[16px] font-extrabold text-white mb-4">내 연기력도 테스트해봐 🎬</p>
          <Link
            href="/audition/solo"
            className="inline-block w-full bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold py-3.5 rounded-2xl text-[15px] transition-colors text-center"
          >
            나도 오디션 도전하기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
