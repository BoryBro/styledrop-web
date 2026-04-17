import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "사용방법",
  description: "StyleDrop에서 카드 선택부터 업로드, 프레임 조정, 저장과 공유까지 빠르게 보는 사용 가이드 페이지.",
};

type GuideStep = {
  number: string;
  label: string;
  title: string;
  description: string;
  detail?: string;
  pill?: string;
  image: string;
  imageAlt: string;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    number: "1",
    label: "스타일 고르기",
    title: "원하는 분위기의 카드를\n선택해보세요.",
    description: "일반 카드와 옵션 카드 중에서 먼저 하나를 고르면 됩니다.",
    image: "/images/how-to/step-1.jpg",
    imageAlt: "스타일 카드 선택 화면",
  },
  {
    number: "2",
    label: "사진 올리기",
    title: "셀카나 앨범 사진을\n올려주세요.",
    description: "촬영 또는 사진 선택 중 편한 방식으로 바로 넣을 수 있어요.",
    detail: "정면을 바라보는 밝은 셀카일수록 결과가 자연스러워요.",
    pill: "사진은 이렇게 선택해요",
    image: "/images/how-to/step-2.jpg",
    imageAlt: "사진 업로드 화면",
  },
  {
    number: "3",
    label: "얼굴 맞추기",
    title: "프레임 안에서\n얼굴 위치를 맞춰주세요.",
    description: "확대, 축소, 이동으로 눈과 얼굴이 프레임 안에 자연스럽게 들어오면 됩니다.",
    image: "/images/how-to/step-3.jpg",
    imageAlt: "프레임 조정 화면",
  },
  {
    number: "4",
    label: "결과 저장하기",
    title: "생성이 끝나면\n저장하거나 공유하세요.",
    description: "결과를 보고 저장, 공유, 다시하기 중 원하는 흐름으로 이어가면 됩니다.",
    image: "/images/how-to/step-4.jpg",
    imageAlt: "결과 저장 화면",
  },
];

export default function HowToPage() {
  return (
    <main className="min-h-screen bg-[#F5F7FB] text-[#1A1A2E]">
      <div className="mx-auto w-full max-w-[520px] px-5 pt-5 sm:px-7 sm:pt-6">
        <Link
          href="/studio"
          aria-label="닫기"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[28px] font-light text-[#1A1A2E] transition-colors hover:bg-[#E8ECF5]"
        >
          ×
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-16 px-6 pb-20 pt-6 sm:max-w-[520px] sm:px-8">
        {GUIDE_STEPS.map((step, index) => (
          <section key={step.number} className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4B82FF] text-[12px] font-bold text-white">
                {step.number}
              </span>
              <p className="text-[14px] font-bold text-[#4B82FF]">{step.label}</p>
            </div>

            <h2
              style={{ fontFamily: "Pretendard, sans-serif" }}
              className="mt-4 whitespace-pre-line text-[26px] font-extrabold leading-[1.3] tracking-[-0.035em] text-[#1A1A2E] sm:text-[30px]"
            >
              {step.title}
            </h2>

            <p className="mt-3 text-[15px] leading-[1.55] text-[#8B95A7] sm:text-[16px]">
              {step.description}
            </p>

            {step.detail && (
              <p className="mt-2 text-[13px] leading-5 text-[#A4ADBF]">{step.detail}</p>
            )}

            {step.pill && (
              <button
                type="button"
                className="mt-4 inline-flex h-10 w-fit items-center gap-1 rounded-full bg-[#EAF1FF] px-4 text-[13px] font-bold text-[#4B82FF] transition-colors hover:bg-[#DAE6FF]"
              >
                {step.pill}
                <span className="text-[15px] leading-none">›</span>
              </button>
            )}

            <div className="mt-7 flex justify-center">
              <div className="w-full overflow-hidden rounded-[24px] bg-white shadow-[0_16px_36px_rgba(122,139,179,0.12)]">
                <div className="relative aspect-[3/4] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={step.image}
                    alt={step.imageAlt}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
              </div>
            </div>
          </section>
        ))}

        <Link
          href="/studio"
          className="mt-4 inline-flex h-14 items-center justify-center rounded-[18px] bg-[#1A1A2E] px-6 text-[15px] font-extrabold text-white shadow-[0_12px_24px_rgba(26,26,46,0.18)] transition-colors hover:bg-[#2A2A3E]"
        >
          스타일 고르러 가기 →
        </Link>
      </div>
    </main>
  );
}
