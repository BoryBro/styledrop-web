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
  popular?: boolean;
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
    tag: "NEW",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
    popular: true,
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
    popular: true,
  },
  // Temporary thumbnail placeholders for new concepts.
  // Replace these paths once final thumbs are ready.
  {
    id: "idol-photocard",
    name: "아이돌 포토카드",
    desc: "포카 뽑고 싶은 맑고 반짝이는 아이돌 셀카 무드",
    bgColor: "#120d1f",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
    popular: true,
  },
  {
    id: "coquette-ribbon",
    name: "리본 코케트",
    desc: "리본, 레이스, 핑크 블러셔의 러블리 코케트 룩",
    bgColor: "#26121f",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
  },
  {
    id: "balletcore-muse",
    name: "오프듀티 발레코어",
    desc: "연습 끝난 발레리나처럼 여리한 무드의 소프트 글램",
    bgColor: "#1f1724",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
  },
  {
    id: "yearbook-2006",
    name: "2006 이어북",
    desc: "사이드뱅, 글로시 립, Y2K 스튜디오 졸업사진 무드",
    bgColor: "#231817",
    tag: "Y2K",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/gyaru-before.jpg",
    afterImg: "/thumbnails/gyaru-after.jpg",
    popular: true,
  },
  {
    id: "club-flash",
    name: "클럽 플래시샷",
    desc: "새벽 파티에서 찍힌 강한 플래시 직격샷 분위기",
    bgColor: "#150d18",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/flash-before.jpg",
    afterImg: "/thumbnails/flash-after.jpg",
    popular: true,
  },
  {
    id: "frosted-glam",
    name: "프로스티 글램",
    desc: "서늘한 펄감과 프로스티 립의 2006 글램 메이크업",
    bgColor: "#101827",
    tag: "Y2K",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/gyaru-before.jpg",
    afterImg: "/thumbnails/gyaru-after.jpg",
  },
  {
    id: "red-carpet-glam",
    name: "레드카펫 글램",
    desc: "시상식 포토월 앞에서 찍힌 셀럽 무드의 에디토리얼 컷",
    bgColor: "#1a1012",
    tag: "NEW",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
  },
  {
    id: "dark-coquette",
    name: "다크 코케트",
    desc: "블랙 레이스와 체리 포인트가 들어간 무드 있는 코케트",
    bgColor: "#170c12",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/angel-before.jpg",
    afterImg: "/thumbnails/angel-after.jpg",
  },
  {
    id: "datecam-film",
    name: "데이트캠 필름",
    desc: "흔들린 플래시와 필름 그레인이 살아있는 감성 데이트샷",
    bgColor: "#191512",
    tag: "FILM",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/flash-before.jpg",
    afterImg: "/thumbnails/flash-after.jpg",
  },
  {
    id: "city-pop-neon",
    name: "네온 시티팝",
    desc: "네온 간판 아래 반짝이는 밤거리 글로시 셀피",
    bgColor: "#0d1624",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/grab-before.jpg",
    afterImg: "/thumbnails/grab-after.jpg",
  },
  {
    id: "ulzzang-cam",
    name: "얼짱캠 부활",
    desc: "뽀용 블러, 큰 눈 포인트, 2010년대 얼짱캠 감성 리메이크",
    bgColor: "#16131f",
    tag: "RETRO",
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
