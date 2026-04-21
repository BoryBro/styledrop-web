import type { Metadata } from "next";
import FeatureLandingPage from "@/components/seo/FeatureLandingPage";

export const metadata: Metadata = {
  title: "관상 테스트",
  description: "얼굴형, 눈매, 인상 포인트를 바탕으로 배역 해석과 연결되는 StyleDrop 관상 테스트 소개 페이지.",
  keywords: ["관상 테스트", "얼굴형 분석", "눈매 분석", "AI 관상", "StyleDrop"],
  alternates: { canonical: "https://www.styledrop.cloud/physiognomy-test" },
};

export default function PhysiognomyTestPage() {
  return (
    <FeatureLandingPage
      eyebrow="PHYSIOGNOMY TEST"
      title="관상 테스트를 검색한 사용자는, 결국 내 얼굴이 어떻게 읽히는지가 궁금한 겁니다."
      description="StyleDrop의 관상 테스트는 단순 미신형 해석보다, 얼굴형과 인상 포인트가 어떤 캐릭터 감각으로 연결되는지 보는 경험에 더 가깝습니다. 특히 AI 오디션 결과 해석과 연결될 때 강해집니다."
      keyword="관상 테스트"
      chips={["얼굴형 분석", "눈매 인상", "캐릭터 해석", "배역 연결"]}
      ctaHref="/audition/intro"
      ctaLabel="AI 오디션에서 보기"
      secondaryHref="/faq"
      secondaryLabel="FAQ 보기"
      introTitle="관상은 정답을 맞히는 기능보다, 인상을 해석하는 경험으로 설계해야 설득력이 생깁니다."
      introBody="StyleDrop은 관상 결과를 단편적인 단어 나열보다, 얼굴의 분위기와 캐릭터 해석으로 읽히게 만드는 방향에 더 가깝습니다. 그래서 AI 오디션 안에서 특히 자연스럽게 작동합니다."
      points={[
        "정면 얼굴이 잘 보이는 사진이 중요합니다.",
        "눈, 코, 입, 얼굴형 인상이 함께 읽혀야 합니다.",
        "결과는 배역 또는 캐릭터 해석과 연결될 때 더 납득됩니다.",
      ]}
      sections={[
        {
          title: "얼굴형 읽기",
          body: "관상 테스트에서 가장 먼저 보이는 건 전체 얼굴형입니다. 날카로운지, 부드러운지, 중심이 강한지 같은 첫 인상은 결과 해석의 기본이 됩니다.",
        },
        {
          title: "눈매와 인상 포인트",
          body: "같은 얼굴형이어도 눈매, 입매, 이마선, 턱선에서 느껴지는 인상이 다릅니다. 그래서 단일 포인트보다 전체 조합으로 읽히는 방식이 더 중요합니다.",
        },
        {
          title: "배역 해석 연결",
          body: "사용자가 가장 재밌게 받아들이는 건 좋은 관상이냐 나쁜 관상이냐가 아니라, 어떤 역할에 어울려 보이느냐입니다. StyleDrop은 그 방향과 더 잘 맞습니다.",
        },
      ]}
      faq={[
        {
          title: "관상 테스트는 셀카로 해도 되나요?",
          body: "가능하지만 정면에 가깝고 얼굴 전체 구조가 잘 보이는 사진이 더 좋습니다. 너무 가까운 광각 셀카나 얼굴이 일부 가려진 사진은 안정성이 떨어질 수 있습니다.",
        },
        {
          title: "관상 결과는 어디에 활용되나요?",
          body: "StyleDrop에서는 특히 AI 오디션 안에서 관상 분석이 배역 해석과 연결됩니다. 단독 결과보다 캐릭터 카드 흐름과 함께 볼 때 이해하기 쉽습니다.",
        },
        {
          title: "관상 테스트만 따로 볼 수 있나요?",
          body: "공개 소개 페이지에서는 개념을 먼저 볼 수 있고, 실제 체험은 AI 오디션 흐름 안에서 확인하는 구조가 더 자연스럽습니다.",
        },
      ]}
    />
  );
}
