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
  "mongolian-warrior": [
    { id: "default", label: "초원 전사", desc: "넓은 초원 위에 선 몽골 전사 다큐멘터리 컷", thumbnail: "/thumbnails/Mongolian-after.jpg?v=1" },
    { id: "tribal", label: "부족 전사", desc: "전통 천막과 창이 함께 보이는 부족 전사 인물사진", thumbnail: "/thumbnails/Mongolian-after.jpg?v=1" },
  ],
};
