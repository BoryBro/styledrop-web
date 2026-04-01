// 스타일별 서브 필터(베리에이션) 정의 — SSOT
// studio 선택 모달, admin 표시, generate API 프롬프트 매핑에 공통 사용

export type Variant = { id: string; label: string; desc?: string };

export const STYLE_VARIANTS: Record<string, Variant[]> = {
  "gyaru": [
    { id: "default", label: "기본 갸루",  desc: "2000년대 정통 갸루 스타일" },
    { id: "dark",    label: "다크 갸루",  desc: "고딕 × 갸루, 강렬한 블랙 무드" },
    { id: "pinku",   label: "핑쿠 갸루",  desc: "파스텔 핑크 카와이 갸루" },
  ],
  "angel": [
    { id: "dark", label: "타락천사",      desc: "다크하고 강렬한 타락천사" },
    { id: "soft", label: "여리여리 천사", desc: "파스텔 톤의 부드러운 천사" },
  ],
};
