// 스타일별 서브 필터(베리에이션) 정의 — SSOT
// studio 선택 모달, admin 표시, generate API 프롬프트 매핑에 공통 사용

export type Variant = { id: string; label: string; desc?: string; thumbnail?: string };

export const STYLE_VARIANTS: Record<string, Variant[]> = {
  "angel": [
    { id: "dark", label: "타락천사",      desc: "다크하고 강렬한 타락천사",       thumbnail: "/thumbnails/angel-dark.jpg" },
    { id: "soft", label: "여리여리 천사", desc: "파스텔 톤의 부드러운 천사",      thumbnail: "/thumbnails/angel-soft.jpg" },
  ],
  "joseon-farmer": [
    { id: "v1", label: "전신샷",       desc: "쉬다가 한 컷 찍어봤어요!",  thumbnail: "/thumbnails/joseon-after.jpg?v=2" },
    { id: "v2", label: "자연 A",       desc: "레퍼런스 스타일 변환",       thumbnail: "/thumbnails/joseon-ref-1.jpg" },
    { id: "v3", label: "자연 B",       desc: "씬 직접 묘사",               thumbnail: "/thumbnails/joseon-ref-1.jpg" },
    { id: "v4", label: "스튜디오 A",   desc: "레퍼런스 스타일 변환",       thumbnail: "/thumbnails/joseon-ref-2.jpg" },
    { id: "v5", label: "스튜디오 B",   desc: "씬 직접 묘사",               thumbnail: "/thumbnails/joseon-ref-2.jpg" },
  ],
};
