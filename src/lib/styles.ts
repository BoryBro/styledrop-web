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
    id: "idol-photocard",
    name: "아이돌 포토카드",
    desc: "포카 뽑고 싶은 맑고 반짝이는 아이돌 셀카 무드",
    bgColor: "#120d1f",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/idol-photocard-before.jpg?v=2",
    afterImg: "/thumbnails/idol-photocard-after.jpg?v=1",
  },
  {
    id: "club-flash",
    name: "클럽 플래시샷",
    desc: "새벽 파티에서 찍힌 강한 플래시 직격샷 분위기",
    bgColor: "#150d18",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/club-flash-before.jpg?v=2",
    afterImg: "/thumbnails/club-flash-after.jpg?v=1",
  },
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
    popular: true,
  },
  {
    id: "red-carpet-glam",
    name: "레드카펫 글램",
    desc: "시상식 포토월 앞에서 찍힌 셀럽 무드의 에디토리얼 컷",
    bgColor: "#1a1012",
    tag: "NEW",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/red-carpet-glam-before.jpg?v=1",
    afterImg: "/thumbnails/red-carpet-glam-after.jpg?v=1",
  },
  {
    id: "dark-coquette",
    name: "다크 코케트",
    desc: "블랙 레이스와 체리 포인트가 들어간 무드 있는 코케트",
    bgColor: "#170c12",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/dark-coquette-before.jpg?v=1",
    afterImg: "/thumbnails/dark-coquette-after.jpg?v=1",
  },
  {
    id: "datecam-film",
    name: "데이트캠 필름",
    desc: "흔들린 플래시와 필름 그레인이 살아있는 감성 데이트샷",
    bgColor: "#191512",
    tag: "FILM",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/datecam-film-before.jpg?v=1",
    afterImg: "/thumbnails/datecam-film-after.jpg?v=1",
  },
  {
    id: "ulzzang-cam",
    name: "얼짱캠 부활",
    desc: "뽀용 블러, 큰 눈 포인트, 2010년대 얼짱캠 감성 리메이크",
    bgColor: "#16131f",
    tag: "RETRO",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/ulzzang-cam-before.jpg",
    afterImg: "/thumbnails/ulzzang-cam-after.jpg?v=1",
  },
  {
    id: "jjimjilbang-master",
    name: "찜질방 만렙",
    desc: "양머리 수건부터 식혜까지 완벽한 K-찜질방 병맛짤",
    bgColor: "#3b2416",
    tag: "MEME",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/jjimjilbang-master-before.jpg?v=1",
    afterImg: "/thumbnails/jjimjilbang-master-after.jpg?v=1",
  },
  {
    id: "skydiving",
    name: "스카이다이빙",
    desc: "하늘 한복판 탠덤 점프 순간을 극한 스포츠 직찍처럼 변환",
    bgColor: "#132b52",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/skydiving-before.jpg?v=2",
    afterImg: "/thumbnails/skydiving-after.jpg?v=2",
  },
  {
    id: "maid-cafe-heart",
    name: "메이드카페 직원 💗",
    desc: "테마 카페에서 찍은 듯한 진심 가득 메이드카페 스냅샷",
    bgColor: "#2a1826",
    tag: "TREND",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/maid-cafe-heart-before.jpg?v=2",
    afterImg: "/thumbnails/maid-cafe-heart-after.jpg?v=2",
  },
  {
    id: "hiphop-grillz",
    name: "힙합 그릴즈 했어요 ✨",
    desc: "다이아 체인과 그릴즈가 강조된 하드한 힙합 에디토리얼 클로즈업",
    bgColor: "#13110f",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/hiphop-grillz-before.jpg?v=1",
    afterImg: "/thumbnails/hiphop-grillz-after.jpg?v=1",
  },
  {
    id: "hellotokyo",
    name: "헬로 도쿄",
    desc: "도쿄 팝 그래픽이 폭발하는 하이텐션 에디토리얼 콜라주 포스터",
    bgColor: "#171511",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/hellotokyo-before.jpg?v=1",
    afterImg: "/thumbnails/hellotokyo-after.jpg?v=1",
  },
  {
    id: "mongolian-warrior",
    name: "몽골의 전사",
    desc: "초원 위에 선 몽골 전사의 다큐멘터리풍 전신 인물사진",
    bgColor: "#2b3321",
    tag: "HOT",
    active: true,
    hidden: false,
    beforeImg: "/thumbnails/Mongolian-before.jpg?v=1",
    afterImg: "/thumbnails/Mongolian-after.jpg?v=1",
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
