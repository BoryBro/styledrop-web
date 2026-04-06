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
  "skydiving": [
    { id: "default", label: "프리폴 스냅", desc: "푸른 하늘 위에서 순간 포착된 스카이다이빙 직찍", thumbnail: "/thumbnails/grab-after.jpg" },
    { id: "tandem_jump", label: "탠덤 점프", desc: "강사와 함께 떨어지는 실제 탠덤 점프 액션샷", thumbnail: "/thumbnails/flash-after.jpg" },
  ],
  "maid-cafe-heart": [
    { id: "default", label: "웰컴 포즈", desc: "테마 카페 직원처럼 카메라를 향해 환영 인사를 건네는 스냅", thumbnail: "/thumbnails/angel-soft.jpg" },
    { id: "heart_pose", label: "하트 포즈", desc: "손하트와 디저트 소품이 함께 잡히는 메이드카페 직찍", thumbnail: "/thumbnails/angel-after.jpg" },
  ],
};
