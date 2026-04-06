// 스타일별 서브 필터(베리에이션) 정의 — SSOT
// studio 선택 모달, admin 표시, generate API 프롬프트 매핑에 공통 사용

export type Variant = { id: string; label: string; desc?: string; thumbnail?: string };

export const STYLE_VARIANTS: Record<string, Variant[]> = {
  "angel": [
    { id: "dark", label: "타락천사",      desc: "다크하고 강렬한 타락천사",       thumbnail: "/thumbnails/angel-dark.jpg" },
    { id: "soft", label: "여리여리 천사", desc: "파스텔 톤의 부드러운 천사",      thumbnail: "/thumbnails/angel-soft.jpg" },
  ],
  "joseon-farmer": [
    { id: "v1", label: "전신샷",            desc: "쉬다가 한 컷 찍어봤어요!",      thumbnail: "/thumbnails/joseon-after.jpg?v=2" },
    { id: "v3", label: "자연에서 한컷 🤍", desc: "부끄러워하듯 웃는게 뽀인트!",   thumbnail: "/thumbnails/joseon-ref-1.jpg" },
    { id: "v5", label: "ootd 인생사진",    desc: "마실 나갔다가 사진 한장~ ✦",    thumbnail: "/thumbnails/joseon-ref-2.jpg" },
  ],
  "jjimjilbang-master": [
    { id: "egg", label: "맥반석 계란", desc: "양머리 수건 쓰고 계란이랑 식혜 먹는 정석 찜질방짤", thumbnail: "/thumbnails/joseon-after.jpg?v=2" },
    { id: "nap", label: "대자로 낮잠", desc: "찜질방 바닥에서 대충 누웠는데 너무 웃긴 생활샷", thumbnail: "/thumbnails/joseon-ref-1.jpg" },
  ],
  "pcbang-legend": [
    { id: "ramen", label: "컵라면 각", desc: "새벽 컵라면과 RGB 조명에 절여진 PC방짤", thumbnail: "/thumbnails/flash-after.jpg" },
    { id: "ranked", label: "랭겜 멘붕", desc: "헤드셋 끼고 랭겜하다가 영혼이 빠진 폐인짤", thumbnail: "/thumbnails/voxel-after.jpg" },
  ],
  "hiking-club": [
    { id: "summit", label: "정상 인증", desc: "정상석 앞에서 건진 산악회 필수 인증샷", thumbnail: "/thumbnails/joseon-ref-2.jpg" },
    { id: "break", label: "약수터 휴식", desc: "등산 중간에 김밥이랑 커피 들고 쉬는 현실짤", thumbnail: "/thumbnails/joseon-ref-1.jpg" },
  ],
  "skydiving": [
    { id: "default", label: "프리폴 스냅", desc: "푸른 하늘 위에서 순간 포착된 스카이다이빙 직찍", thumbnail: "/thumbnails/grab-after.jpg" },
    { id: "tandem_jump", label: "탠덤 점프", desc: "강사와 함께 떨어지는 실제 탠덤 점프 액션샷", thumbnail: "/thumbnails/flash-after.jpg" },
  ],
  "maid-cafe-heart": [
    { id: "default", label: "웰컴 포즈", desc: "테마 카페 직원처럼 카메라를 향해 환영 인사를 건네는 스냅", thumbnail: "/thumbnails/angel-soft.jpg" },
    { id: "heart_pose", label: "하트 포즈", desc: "손하트와 디저트 소품이 함께 잡히는 메이드카페 직찍", thumbnail: "/thumbnails/angel-after.jpg" },
  ],
  "service-area-snack": [
    { id: "hotdog", label: "핫도그 먹방", desc: "휴게소 핫도그 하나 들고도 완성되는 여행짤", thumbnail: "/thumbnails/flash-after.jpg" },
    { id: "rest", label: "장거리 휴식", desc: "휴게소 간판 앞에서 멍한 표정으로 찍힌 현실샷", thumbnail: "/thumbnails/grab-after.jpg" },
  ],
  "retreat-staff": [
    { id: "whistle", label: "호루라기 조교", desc: "체육관에서 인원 통제하는 수련회 조교짤", thumbnail: "/thumbnails/joseon-ref-2.jpg" },
    { id: "campfire", label: "캠프파이어", desc: "밤 수련회에서 사회 보는 조교 감성짤", thumbnail: "/thumbnails/joseon-after.jpg?v=2" },
  ],
  "wedding-guest-chaos": [
    { id: "buffet", label: "뷔페 동선", desc: "하객룩은 완벽한데 뷔페 가다 걸린 웃긴 직찍", thumbnail: "/thumbnails/angel-after.jpg" },
    { id: "photo", label: "포토테이블", desc: "결혼식 포토월 앞에서 어정쩡하게 찍힌 현실짤", thumbnail: "/thumbnails/angel-soft.jpg" },
  ],
  "baseball-date": [
    { id: "beer", label: "맥주 한잔", desc: "야구장 맥주컵 들고 응원하다 건진 직관짤", thumbnail: "/thumbnails/grab-after.jpg" },
    { id: "cheer", label: "응원봉 폭주", desc: "응원봉 들고 소리치다가 잡힌 야구장 현장짤", thumbnail: "/thumbnails/flash-after.jpg" },
  ],
  "pojangmacha-night": [
    { id: "soju", label: "소주 한잔", desc: "플라스틱 의자에 앉아 소주잔 들고 찍힌 새벽짤", thumbnail: "/thumbnails/flash-after.jpg" },
    { id: "fishcake", label: "오뎅 국물", desc: "포장마차에서 오뎅 국물 마시는 인간미 레전드짤", thumbnail: "/thumbnails/joseon-ref-1.jpg" },
  ],
};
