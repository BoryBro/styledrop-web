// ── 스타일 정의 SSOT (Single Source of Truth) ─────────────────────────
// 새 필터 추가/삭제 시 이 파일만 수정하면 studio, mypage, generate 등 자동 반영

export type StyleDef = {
  id: string;
  name: string;
  desc: string;
  bgColor: string;
  tag: string;
  active: boolean;
  hidden: boolean;
  beforeImg: string;
  afterImg: string;
};

export const ALL_STYLES: StyleDef[] = [
  {
    id: "flash-selfie",
    name: "플래시 필터",
    desc: "플래시 터트린듯한 느낌 적용",
    bgColor: "#1a1010",
    tag: "무료",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/flash-before.jpg",
    afterImg: "/thumbnails/flash-after.jpg",
  },
  {
    id: "grab-selfie",
    name: "베트남 오토바이 셀카 필터",
    desc: "얼굴이 보이는 정확한 셀카 사진을 업로드해주세요.",
    bgColor: "#0e2a1a",
    tag: "무료",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/grab-before.jpg",
    afterImg: "/thumbnails/grab-after.jpg",
  },
  {
    id: "voxel-character",
    name: "픽셀 캐릭터 필터",
    desc: "사진 속 나를 블록으로 만든 3D 캐릭터로 변환",
    bgColor: "#0a1a2a",
    tag: "무료",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/voxel-before.jpg",
    afterImg: "/thumbnails/voxel-after.jpg",
  },
  {
    id: "joseon-farmer",
    name: "조선시대 농부",
    desc: "얼굴이 잘 보이는 정면 사진을 업로드해주세요.",
    bgColor: "#1a1408",
    tag: "NEW",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/joseon-before.jpg?v=2",
    afterImg: "/thumbnails/joseon-after.jpg?v=2",
  },
  {
    id: "angel",
    name: "천사 변신",
    desc: "타락천사부터 여리여리 천사까지, 나만의 천사 스타일",
    bgColor: "#0e0e1a",
    tag: "SOON",
    active: false,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
  },
  {
    id: "gyaru",
    name: "나는 이제부터 갸루",
    desc: "2000년대 일본 프리쿠라 갸루 스타일로 변신",
    bgColor: "#2a0a1a",
    tag: "NEW",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/gyaru-before.jpg",
    afterImg: "/thumbnails/gyaru-after.jpg",
  },
];

/** UI에 표시되는 스타일만 (hidden === false) */
export const VISIBLE_STYLES = ALL_STYLES.filter((s) => !s.hidden);

/** 모든 스타일의 ID → 이름 매핑 */
export const STYLE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_STYLES.map((s) => [s.id, s.name])
);

/** UI에 표시되는 스타일 ID 순서 배열 */
export const VISIBLE_STYLE_IDS = VISIBLE_STYLES.map((s) => s.id);
