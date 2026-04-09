// Seed script: insert 10 dummy Daejeon traces into Supabase
// Run: node scripts/seed-daejeon-traces.mjs

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TRACE_EVENT_TYPE = "lab_trace_join";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
function jitterFromHash(hash) {
  return ((hash % 10000) / 9999) * 2 - 1;
}

const DAEJEON_ANCHOR = { x: 53, y: 51 };
const SPREAD = 3.8;

function buildPoint(sigungu, dong, userId) {
  const seedBase = `daejeon:${sigungu}:${dong}:${userId}`;
  const hashX = hashString(`${seedBase}:x`);
  const hashY = hashString(`${seedBase}:y`);
  const x = clamp(DAEJEON_ANCHOR.x + jitterFromHash(hashX) * SPREAD, 10, 90);
  const y = clamp(DAEJEON_ANCHOR.y + jitterFromHash(hashY) * (SPREAD + 1.1), 10, 112);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}

const TRACES = [
  { sigungu: "서구",   dong: "도마동",  nickname: "도마동스타일",   kakaoId: 8888000001, instagram: "style.by.do",     img: "https://picsum.photos/seed/dj01/400/500" },
  { sigungu: "서구",   dong: "갈마동",  nickname: "갈마패션",       kakaoId: 8888000002, instagram: null,              img: "https://picsum.photos/seed/dj02/400/500" },
  { sigungu: "유성구", dong: "봉명동",  nickname: "유성룩북",       kakaoId: 8888000003, instagram: "yuseong_look",    img: "https://picsum.photos/seed/dj03/400/500" },
  { sigungu: "유성구", dong: "궁동",    nickname: "궁동감성",       kakaoId: 8888000004, instagram: null,              img: null },
  { sigungu: "중구",   dong: "은행동",  nickname: "은행동핏",       kakaoId: 8888000005, instagram: "eunhaeng.fit",    img: "https://picsum.photos/seed/dj05/400/500" },
  { sigungu: "중구",   dong: "목동",    nickname: "목동데일리",     kakaoId: 8888000006, instagram: null,              img: "https://picsum.photos/seed/dj06/400/500" },
  { sigungu: "동구",   dong: "삼성동",  nickname: "삼성동룩",       kakaoId: 8888000007, instagram: "daejeon_daily",   img: null },
  { sigungu: "동구",   dong: "홍도동",  nickname: "홍도스냅",       kakaoId: 8888000008, instagram: null,              img: "https://picsum.photos/seed/dj08/400/500" },
  { sigungu: "대덕구", dong: "법동",    nickname: "법동패션",       kakaoId: 8888000009, instagram: "beopdonger",      img: "https://picsum.photos/seed/dj09/400/500" },
  { sigungu: "서구",   dong: "탄방동",  nickname: "탄방데일리",     kakaoId: 8888000010, instagram: null,              img: "https://picsum.photos/seed/dj10/400/500" },
];

async function main() {
  console.log("Inserting 10 dummy Daejeon users + traces...\n");

  for (const t of TRACES) {
    const userId = randomUUID();
    const sido = "대전광역시";
    const regionLabel = `${sido} ${t.sigungu} ${t.dong}`;

    // 1. Insert fake user
    const { error: userErr } = await supabase.from("users").insert({
      id: userId,
      kakao_id: t.kakaoId,
      nickname: t.nickname,
      profile_image: `https://picsum.photos/seed/u${t.kakaoId}/80/80`,
    });
    if (userErr) {
      console.error(`❌ user ${t.nickname}:`, userErr.message);
      continue;
    }

    // 2. Insert trace
    const { x, y } = buildPoint(t.sigungu, t.dong, userId);
    const { error: traceErr } = await supabase.from("user_events").insert({
      user_id: userId,
      event_type: TRACE_EVENT_TYPE,
      metadata: {
        sido,
        sigungu: t.sigungu,
        dong: t.dong,
        x,
        y,
        region_key: `${sido}|${t.sigungu}|${t.dong}`,
        region_label: regionLabel,
        public_image_url: t.img,
        public_image_path: null,
        instagram_handle: t.instagram,
      },
    });

    if (traceErr) {
      console.error(`❌ trace ${regionLabel}:`, traceErr.message);
    } else {
      console.log(`✓ ${regionLabel}${t.instagram ? ` @${t.instagram}` : ""}${t.img ? " [img]" : ""}`);
    }
  }

  console.log("\nDone.");
}

main();
