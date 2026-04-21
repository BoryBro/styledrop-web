import type { Metadata } from "next";
import FeatureLandingPage from "@/components/seo/FeatureLandingPage";

export const metadata: Metadata = {
  title: "AI 오디션",
  description: "관상 분석, 성향 선택, 씬 촬영을 묶어 배역 결과와 카드 출력까지 이어지는 StyleDrop AI 오디션 소개 페이지.",
  keywords: ["AI 오디션", "배역 테스트", "관상 분석", "연기 테스트", "StyleDrop"],
  alternates: { canonical: "https://www.styledrop.cloud/ai-audition" },
};

export default function AiAuditionPage() {
  return (
    <FeatureLandingPage
      eyebrow="AI AUDITION"
      title="AI 오디션은 사진 3장이 아니라, 당신이 어떤 배역으로 읽히는지를 판정하는 흐름입니다."
      description="StyleDrop AI 오디션은 장르 선택, 밸런스 게임, 관상 분석, 씬 촬영, 배역 결과 카드까지 하나의 흐름으로 이어집니다. 단순 얼굴 필터와는 전혀 다른 체험형 결과 구조입니다."
      keyword="AI 오디션"
      chips={["배역 테스트", "관상 분석", "성향 분석", "캐릭터 카드"]}
      ctaHref="/audition/intro"
      ctaLabel="AI 오디션 소개 보기"
      secondaryHref="/how-to"
      secondaryLabel="사용방법 보기"
      introTitle="중요한 건 예쁜 사진이 아니라, 어떤 역할로 느껴지는지입니다."
      introBody="AI 오디션은 사용자의 얼굴, 성향, 씬별 표정을 종합해서 캐스팅 결과처럼 읽히는 리포트와 카드 결과를 제공합니다. 그래서 재미 요소와 결과 해석이 같이 움직입니다."
      points={[
        "장르 3개를 먼저 고르고 시작합니다.",
        "성향 선택과 관상 분석이 함께 반영됩니다.",
        "최종 결과는 배역 카드와 스틸컷 흐름으로 이어집니다.",
      ]}
      sections={[
        {
          title: "배역 중심 결과",
          body: "결과는 단순 점수표가 아니라 배역 해석 중심으로 읽히도록 구성됩니다. 사용자가 스스로 결과를 소비하는 재미가 있어야 오디션 페이지가 살아납니다.",
        },
        {
          title: "관상 + 성향 + 씬",
          body: "AI 오디션의 핵심은 얼굴 한 장만 보는 것이 아니라는 점입니다. 관상용 사진, 밸런스 게임, 씬별 촬영을 함께 보며 결과를 조합합니다.",
        },
        {
          title: "공유 가능한 카드",
          body: "결과는 끝나고 사라지는 테스트가 아니라 카드와 스틸컷처럼 남는 형태로 이어집니다. 그래서 결과물 자체가 공유 동기가 되도록 설계됩니다.",
        },
      ]}
      faq={[
        {
          title: "AI 오디션은 몇 크레딧이 필요한가요?",
          body: "현재 운영 기준으로 AI 오디션은 시작 시 5크레딧 패키지 흐름으로 운영됩니다. 실제 정책은 상점과 안내 문구를 기준으로 확인하는 것이 가장 정확합니다.",
        },
        {
          title: "AI 오디션은 어떤 사진을 올려야 하나요?",
          body: "관상용 사진 1장과 씬 사진 3장이 필요합니다. 얼굴 구조가 잘 보이는 사진과, 표정이 읽히는 씬 촬영 사진이 결과 안정성에 중요합니다.",
        },
        {
          title: "결과는 저장되나요?",
          body: "AI 오디션 결과는 기록, 카드, 공유 흐름과 연결될 수 있습니다. 자세한 저장 정책은 개인정보처리방침과 FAQ에서 확인할 수 있습니다.",
        },
      ]}
    />
  );
}
