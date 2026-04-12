/**
 * 메인 스토리 슬라이더 초기화 + 썸네일 이미지로 채우기
 * 실행: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-showcase.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수를 설정해주세요.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BASE_URL = "https://styledrop.cloud";

const ITEMS = [
  { kakaoId: "7777000001", nickname: "갸루", imageFile: "gyaru-after.jpg",           styleId: "gyaru" },
  { kakaoId: "7777000002", nickname: "엔젤", imageFile: "angel-after.jpg",            styleId: "angel" },
  { kakaoId: "7777000003", nickname: "아이돌", imageFile: "idol-photocard-after.jpg", styleId: "idol-photocard" },
  { kakaoId: "7777000004", nickname: "다크", imageFile: "dark-coquette-after.jpg",    styleId: "dark-coquette" },
  { kakaoId: "7777000005", nickname: "글램", imageFile: "red-carpet-glam-after.jpg",  styleId: "red-carpet-glam" },
  { kakaoId: "7777000006", nickname: "도쿄", imageFile: "hellotokyo-after.jpg",       styleId: "hellotokyo" },
  { kakaoId: "7777000007", nickname: "울짱", imageFile: "ulzzang-cam-after.jpg",      styleId: "ulzzang-cam" },
  { kakaoId: "7777000008", nickname: "플래시", imageFile: "flash-after.jpg",          styleId: "flash" },
  { kakaoId: "7777000009", nickname: "클럽", imageFile: "club-flash-after.jpg",       styleId: "club-flash" },
  { kakaoId: "7777000010", nickname: "치어", imageFile: "cheerleader-after.jpg",      styleId: "cheerleader" },
];

async function run() {
  // 1. 기존 showcase opt-in 이벤트 전체 삭제
  console.log("🗑  기존 showcase opt-in 이벤트 삭제 중...");
  const { error: delEvtErr } = await supabase
    .from("user_events")
    .delete()
    .eq("event_type", "home_showcase_opt_in");
  if (delEvtErr) { console.error("❌ 이벤트 삭제 실패:", delEvtErr.message); process.exit(1); }

  // opt-out 이벤트도 정리
  await supabase.from("user_events").delete().eq("event_type", "home_showcase_opt_out");

  // 2. 이전 플레이스홀더 유저 삭제 (kakao_id 7777000xxx)
  console.log("🗑  이전 플레이스홀더 유저 삭제 중...");
  for (const item of ITEMS) {
    await supabase.from("users").delete().eq("kakao_id", item.kakaoId);
  }

  // 3. 플레이스홀더 유저 생성
  console.log("👤 플레이스홀더 유저 생성 중...");
  const userRows = ITEMS.map((item) => ({
    kakao_id: item.kakaoId,
    nickname: item.nickname,
    profile_image: null,
    email: null,
    last_login_at: new Date().toISOString(),
  }));

  const { data: users, error: userErr } = await supabase
    .from("users")
    .insert(userRows)
    .select("id, kakao_id");
  if (userErr) { console.error("❌ 유저 생성 실패:", userErr.message); process.exit(1); }

  const userMap = Object.fromEntries(users.map((u) => [u.kakao_id, u.id]));

  // 4. showcase opt-in 이벤트 삽입
  console.log("🖼  showcase 이벤트 삽입 중...");
  for (const item of ITEMS) {
    const userId = userMap[item.kakaoId];
    const imageUrl = `${BASE_URL}/thumbnails/${item.imageFile}`;
    const { error } = await supabase.from("user_events").insert({
      user_id: userId,
      event_type: "home_showcase_opt_in",
      metadata: {
        image_url: imageUrl,
        storage_path: null,
        style_id: item.styleId,
        variant: "default",
        instagram_handle: null,
      },
    });
    if (error) {
      console.error(`❌ ${item.nickname} 이벤트 실패:`, error.message);
    } else {
      console.log(`  ✅ ${item.nickname} — ${item.imageFile}`);
    }
  }

  console.log("\n🎉 완료! 메인 스토리 슬라이더에 썸네일 10장이 등록됐어요.");
}

run();
