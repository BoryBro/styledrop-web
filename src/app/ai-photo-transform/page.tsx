import type { Metadata } from "next";
import FeatureLandingPage from "@/components/seo/FeatureLandingPage";

export const metadata: Metadata = {
  title: "AI 사진 변환",
  description: "사진 한 장으로 감성 카드, 콘셉트 이미지, 캐릭터 무드를 만드는 StyleDrop AI 사진 변환 소개 페이지.",
  keywords: ["AI 사진 변환", "사진 변환 사이트", "AI 이미지 변환", "감성 카드 만들기", "StyleDrop"],
  alternates: { canonical: "https://www.styledrop.cloud/ai-photo-transform" },
};

export default function AiPhotoTransformPage() {
  return (
    <FeatureLandingPage
      eyebrow="AI PHOTO TRANSFORM"
      title="AI 사진 변환을 찾는다면, StyleDrop이 먼저 보여줘야 할 건 결과물의 분위기입니다."
      description="StyleDrop은 사진 한 장으로 끝나는 단순 필터가 아니라, 장면과 캐릭터 무드가 분명한 결과물을 만드는 AI 사진 변환 서비스입니다. 일반 카드부터 감성 콘셉트 컷까지 한 번에 이어집니다."
      keyword="AI 사진 변환"
      chips={["AI 이미지 변환", "감성 카드", "사진 한 장", "스타일 카드"]}
      ctaHref="/studio"
      ctaLabel="일반 카드 보러가기"
      secondaryHref="/how-to"
      secondaryLabel="사용 흐름 보기"
      introTitle="결과가 예뻐 보이는 것보다, 다시 공유하고 싶은지가 더 중요합니다."
      introBody="StyleDrop의 일반 카드는 단순한 색감 필터가 아니라 장면 설정, 스타일 무드, 캐릭터 해석을 함께 설계합니다. 그래서 결과를 본 뒤 저장과 공유까지 이어지도록 설계되어 있습니다."
      points={[
        "사진 한 장으로 바로 시작할 수 있습니다.",
        "일상, 무드, 자연, 컨셉, 스포츠 톤으로 결과가 나뉩니다.",
        "결과는 저장, 공유, 재확인이 가능한 구조로 이어집니다.",
      ]}
      sections={[
        {
          title: "일반 카드 중심",
          body: "StyleDrop의 AI 사진 변환은 일반 카드 경험이 중심입니다. 사용자는 원하는 무드를 선택하고, 결과물은 단순 보정이 아니라 하나의 콘셉트 장면처럼 완성됩니다.",
        },
        {
          title: "결과 공유 최적화",
          body: "결과물은 화면 안에서 끝나지 않도록 저장과 공유 흐름을 염두에 두고 구성됩니다. 검색 유입 사용자가 처음 접했을 때도 결과 형태를 이해하기 쉬운 구조입니다.",
        },
        {
          title: "모바일 중심 사용성",
          body: "대부분의 사용자는 모바일에서 사진을 올리고 바로 결과를 확인합니다. 그래서 업로드부터 확인, 저장까지 짧은 흐름으로 끊기지 않게 설계되어 있습니다.",
        },
      ]}
      faq={[
        {
          title: "AI 사진 변환은 어떤 사진이 잘 나오나요?",
          body: "얼굴이 비교적 잘 보이고, 조명이 너무 어둡지 않은 사진이 좋습니다. 전신보다 상반신이나 얼굴 중심 사진이 일반 카드 결과에서 더 안정적입니다.",
        },
        {
          title: "필터 앱이랑 뭐가 다른가요?",
          body: "StyleDrop은 단순 색감 필터보다 장면 자체를 다시 해석하는 방향에 가깝습니다. 결과가 카드나 콘셉트 컷처럼 보이도록 설계된 점이 차이입니다.",
        },
        {
          title: "로그인 없이도 볼 수 있나요?",
          body: "일부 흐름은 체험 가능하지만, 저장이나 결제, 마이페이지 기반 기능은 로그인 후 이용하는 구조입니다.",
        },
      ]}
    />
  );
}
