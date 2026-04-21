import type { Metadata } from "next";
import FeatureLandingPage from "@/components/seo/FeatureLandingPage";

export const metadata: Metadata = {
  title: "퍼스널컬러 테스트",
  description: "사진 기반으로 컬러 톤을 빠르게 확인하고, 추천 색감까지 이어보는 StyleDrop 퍼스널컬러 테스트 소개 페이지.",
  keywords: ["퍼스널컬러 테스트", "퍼스널컬러", "웜톤 쿨톤 테스트", "AI 퍼스널컬러", "StyleDrop"],
  alternates: { canonical: "https://www.styledrop.cloud/personal-color-test" },
};

export default function PersonalColorTestPage() {
  return (
    <FeatureLandingPage
      eyebrow="PERSONAL COLOR TEST"
      title="퍼스널컬러 테스트를 찾는 사람은, 결과보다도 이해하기 쉬운 톤 가이드를 원합니다."
      description="StyleDrop의 퍼스널컬러 테스트는 단순히 웜톤·쿨톤 한 줄로 끝나지 않고, 실제로 어떤 색이 잘 맞는지 결과 흐름까지 이어지는 방향으로 구성됩니다."
      keyword="퍼스널컬러 테스트"
      chips={["퍼스널컬러", "웜톤 쿨톤", "색상 추천", "사진 기반 분석"]}
      ctaHref="/personal-color"
      ctaLabel="퍼스널컬러 시작하기"
      secondaryHref="/how-to"
      secondaryLabel="사용 흐름 보기"
      introTitle="잘 어울리는 색을 말해주는 것과, 실제로 적용할 수 있게 만드는 건 다릅니다."
      introBody="StyleDrop은 퍼스널컬러 결과를 단어로만 던지지 않고, 사용자 입장에서 바로 이해하고 연결할 수 있는 컬러 결과 경험을 만드는 데 초점을 둡니다."
      points={[
        "사진으로 빠르게 톤 방향을 확인할 수 있습니다.",
        "결과는 실제 색감 선택과 연결되도록 설계됩니다.",
        "다른 스타일 기능과 함께 보면 활용도가 높아집니다.",
      ]}
      sections={[
        {
          title: "입문자 친화적",
          body: "퍼스널컬러를 처음 보는 사용자도 어렵지 않게 이해할 수 있어야 합니다. 그래서 결과 표현은 최대한 직관적이고 짧게 읽히도록 구성하는 것이 중요합니다.",
        },
        {
          title: "실전 연결성",
          body: "진짜 필요한 건 이론보다 적용입니다. 어떤 색감의 의상, 메이크업, 분위기가 잘 맞는지 자연스럽게 이어지는 구조가 퍼스널컬러 페이지의 핵심입니다.",
        },
        {
          title: "사진 기반 확인",
          body: "텍스트 테스트보다 얼굴 사진 기반 결과는 사용자가 더 쉽게 납득합니다. 그래서 업로드 경험과 결과 설명의 일관성이 중요합니다.",
        },
      ]}
      faq={[
        {
          title: "퍼스널컬러 테스트는 정면 사진이 좋은가요?",
          body: "네. 얼굴이 잘 보이고 조명이 너무 강하게 깨지지 않은 정면 사진이 가장 안정적입니다. 색 왜곡이 심한 필터 사진은 피하는 편이 좋습니다.",
        },
        {
          title: "웜톤, 쿨톤만 알려주나요?",
          body: "기본 톤 방향만 보여주는 것보다, 사용자가 실제로 활용할 수 있는 컬러 감각으로 이어지는 결과가 더 중요합니다. StyleDrop은 그 해석 경험에 초점을 둡니다.",
        },
        {
          title: "퍼스널컬러 결과와 일반 카드 결과는 연결되나요?",
          body: "연결해서 볼수록 도움이 됩니다. 색감 결과를 알고 나면 어떤 스타일 카드가 더 잘 어울리는지도 더 쉽게 판단할 수 있습니다.",
        },
      ]}
    />
  );
}
