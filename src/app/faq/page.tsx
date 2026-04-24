import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "./FaqAccordion";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";

export const metadata: Metadata = {
  title: "FAQ",
  description: "StyleDrop 서비스 소개, 크레딧, 저장, 공유, 환불, 문의 방법을 확인할 수 있는 공개 FAQ 페이지.",
};

const FAQ_ITEMS = [
  {
    question: "StyleDrop은 어떤 서비스인가요?",
    answer:
      "StyleDrop은 사진 기반 AI 결과물을 제공하는 웹 서비스입니다. 일반 카드 변환, 퍼스널 컬러, AI 오디션, 결과 저장과 공유 기능을 제공합니다.",
  },
  {
    question: "회원가입 없이도 사용할 수 있나요?",
    answer:
      "일부 기능은 로그인 없이 체험할 수 있지만, 저장·결제·마이페이지·공유 보상 같은 기능은 카카오 로그인이 필요합니다.",
  },
  {
    question: "크레딧은 어디에 쓰이나요?",
    answer:
      "크레딧은 AI 결과 생성 기능에 사용됩니다. 일반 카드 계열은 보통 1회 1크레딧, AI 오디션은 현재 1회 5크레딧 패키지 기준으로 운영됩니다.",
  },
  {
    question: "신규 가입 보상은 있나요?",
    answer:
      "카카오 로그인으로 처음 가입하면 1크레딧이 지급됩니다. 추가 보상은 이벤트 또는 결과 공유 조건에 따라 달라질 수 있습니다.",
  },
  {
    question: "AI 오디션은 어떤 방식으로 진행되나요?",
    answer:
      "관상용 사진 1장과 씬 사진 3장을 바탕으로 분석 리포트를 제공하고, 선택한 사진을 기준으로 스틸컷 생성 및 카드 편집 흐름을 제공합니다.",
  },
  {
    question: "결과물은 저장되나요?",
    answer:
      "마이페이지 최근 기록, 공유 페이지, 공개 스토리 같은 기능을 위해 원본 사진, 결과 이미지, 메타데이터가 저장될 수 있습니다. 사용자는 일부 기록을 직접 삭제할 수 있습니다.",
  },
  {
    question: "공유 링크나 공개 스토리는 누구나 볼 수 있나요?",
    answer:
      "공유 링크는 주소를 아는 사람이 접근할 수 있고, 공개 스토리에 올린 결과물은 다른 방문자에게 노출될 수 있습니다. 공개 기능은 사용자가 직접 선택할 때만 활성화됩니다.",
  },
  {
    question: "환불은 어떻게 진행되나요?",
    answer:
      "환불은 자동 버튼이 아니라 운영자 확인 방식입니다. 결제 후 7일 이내, 미사용 또는 일부 사용 여부에 따라 환불 가능 금액이 계산되며, support@styledrop.cloud 로 요청해야 합니다.",
  },
  {
    question: "문의는 어디로 하면 되나요?",
    answer:
      "서비스 문의, 환불 요청, 개인정보 관련 요청은 support@styledrop.cloud 로 접수할 수 있습니다.",
  },
  {
    question: "광고와 쿠키는 어떻게 처리되나요?",
    answer:
      "광고 적용 시 Google AdSense가 광고 노출과 성과 측정을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다. 자세한 내용은 개인정보처리방침에서 확인할 수 있습니다.",
  },
];

const SEO_GUIDE_LINKS = [
  { href: "/ai-photo-transform", label: "AI 사진 변환", desc: "일반 카드와 감성형 결과 소개" },
  { href: "/ai-profile-photo", label: "AI 프로필 사진", desc: "프로필용 결과와 무드형 출력 소개" },
  { href: "/personal-color-test", label: "퍼스널컬러 테스트", desc: "사진 기반 톤 가이드 소개" },
  { href: "/ai-audition", label: "AI 오디션", desc: "배역 판정 흐름과 결과 구조 소개" },
  { href: "/physiognomy-test", label: "관상 테스트", desc: "얼굴 인상 해석과 배역 연결 소개" },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#C9571A] transition-colors hover:text-[#B34A12]"
          >
            &larr; 돌아가기
          </Link>
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white/40">Public FAQ</p>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl">
              StyleDrop 서비스 안내
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              서비스 소개, 크레딧, 저장, 공유, 환불, 문의 방법을 한 페이지에서 확인할 수 있는 공개 안내 페이지입니다.
            </p>
          </div>
        </div>

        <section className="space-y-2">
          <p className="text-[12px] uppercase tracking-[0.24em] text-white/35">Contact</p>
          <p className="text-[15px] leading-7 text-white/68">
            문의:{" "}
            <a href="mailto:support@styledrop.cloud" className="text-white underline underline-offset-4">
              support@styledrop.cloud
            </a>
          </p>
        </section>

        <section className="space-y-4 border-t border-white/10 pt-6">
          <div className="space-y-2">
            <p className="text-[12px] uppercase tracking-[0.24em] text-white/35">Public Guide</p>
            <p className="text-[15px] leading-7 text-white/68">
              검색으로 들어온 사용자가 바로 이해할 수 있도록 공개 설명 페이지를 따로 운영하고 있습니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SEO_GUIDE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[18px] border border-white/10 px-4 py-4 transition-colors hover:border-white/20 hover:bg-white/[0.03]"
              >
                <p className="text-[15px] font-bold tracking-[-0.02em] text-white">{link.label}</p>
                <p className="mt-1 text-[13px] leading-6 text-white/52">{link.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <FaqAccordion items={FAQ_ITEMS} />

        <GoogleAd
          slot={ADSENSE_PAGE_SLOTS.faq}
          theme="light"
          className="mt-2"
        />

        <section className="border-t border-white/10 pt-6 text-sm leading-6 text-white/58">
          <p>
            자세한 정책은 <Link href="/terms" className="text-white underline underline-offset-4">이용약관</Link>,
            {" "}
            <Link href="/privacy" className="text-white underline underline-offset-4">개인정보처리방침</Link>에서 확인할 수 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
