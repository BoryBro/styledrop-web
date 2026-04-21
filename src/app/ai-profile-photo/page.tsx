import type { Metadata } from "next";
import FeatureLandingPage from "@/components/seo/FeatureLandingPage";

export const metadata: Metadata = {
  title: "AI 프로필 사진",
  description: "감성 무드, 콘셉트 컷, 캐릭터 톤까지 반영해 프로필용 결과물을 만드는 StyleDrop AI 프로필 사진 소개 페이지.",
  keywords: ["AI 프로필 사진", "프로필 사진 만들기", "감성 프로필", "AI 셀카 변환", "StyleDrop"],
  alternates: { canonical: "https://www.styledrop.cloud/ai-profile-photo" },
};

export default function AiProfilePhotoPage() {
  return (
    <FeatureLandingPage
      eyebrow="AI PROFILE PHOTO"
      title="AI 프로필 사진은 예쁘기만 하면 끝이 아닙니다. 어떤 사람처럼 보이는지가 더 중요합니다."
      description="StyleDrop은 프로필 사진을 한 장의 얼굴 보정으로 끝내지 않습니다. 사용자의 분위기와 선택한 스타일을 바탕으로, 저장하고 올리고 싶은 프로필 결과물을 만드는 데 초점을 둡니다."
      keyword="AI 프로필 사진"
      chips={["프로필 사진", "감성 셀카", "콘셉트 프로필", "캐릭터 톤"]}
      ctaHref="/studio"
      ctaLabel="프로필 스타일 보러가기"
      secondaryHref="/faq"
      secondaryLabel="FAQ 보기"
      introTitle="프로필은 선명한 얼굴보다, 기억에 남는 인상이 더 오래 갑니다."
      introBody="StyleDrop의 프로필 계열 결과는 단순한 정면 증명사진 보정보다, 누가 봐도 스타일이 느껴지는 인상에 집중합니다. 감성, 무드, 콘셉트가 결과에 남도록 설계합니다."
      points={[
        "셀카 기반으로도 시작할 수 있습니다.",
        "일상형보다 분위기형 프로필 결과에 강합니다.",
        "마이페이지에서 최근 결과를 다시 확인할 수 있습니다.",
      ]}
      sections={[
        {
          title: "감성형 프로필",
          body: "차갑고 정적인 증명사진보다, SNS나 개인 브랜딩에 더 어울리는 감성형 결과를 목표로 합니다. 그래서 무드 선택이 결과의 핵심이 됩니다.",
        },
        {
          title: "스타일별 차별화",
          body: "같은 얼굴도 어떤 무드를 고르느냐에 따라 전혀 다른 인상으로 읽힙니다. StyleDrop은 그 차이를 명확하게 보여주는 쪽으로 설계되어 있습니다.",
        },
        {
          title: "공유 가능한 출력물",
          body: "프로필 결과는 단순 확인용이 아니라, 실제로 저장하고 공유할 수 있는 출력물 형태를 전제로 합니다. 그래서 카드형 결과 경험과 자연스럽게 연결됩니다.",
        },
      ]}
      faq={[
        {
          title: "AI 프로필 사진으로 쓰기 좋은 스타일은 어떤 건가요?",
          body: "무드형, 감성형, 컨셉형 카드가 프로필 사진 용도로 잘 맞습니다. 너무 복잡한 장면보다 얼굴 인상과 톤이 살아나는 결과가 유리합니다.",
        },
        {
          title: "정면 사진이 꼭 필요한가요?",
          body: "정면이 가장 안정적이지만, 살짝 각도가 있는 셀카도 가능합니다. 다만 얼굴이 너무 작거나 가려지면 결과 안정성이 떨어질 수 있습니다.",
        },
        {
          title: "프로필 사진으로 바로 저장 가능한가요?",
          body: "결과는 저장과 재확인 구조를 지원하며, 사용자는 마이페이지에서 최근 변환 기록을 다시 볼 수 있습니다.",
        },
      ]}
    />
  );
}
