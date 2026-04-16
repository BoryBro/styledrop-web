import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "사용방법",
  description: "StyleDrop에서 카드 선택부터 업로드, 프레임 조정, 저장과 공유까지 빠르게 보는 사용 가이드 페이지.",
};

type GuideTip = {
  label: string;
  text: string;
};

type GuideStep = {
  number: string;
  label: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  tip: GuideTip | null;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    number: "1",
    label: "스타일 고르기",
    title: "원하는 분위기의 카드를\n선택해보세요.",
    description: "일반 카드와 옵션 카드 중에서 먼저 하나를 고르면 됩니다.",
    image: "/images/how-to/step-1.png",
    imageAlt: "스타일 카드 선택 화면",
    tip: null,
  },
  {
    number: "2",
    label: "사진 올리기",
    title: "셀카나 앨범 사진을\n올려주세요.",
    description: "촬영 또는 사진 선택 중 편한 방식으로 바로 넣을 수 있어요.",
    image: "/images/how-to/step-2.png",
    imageAlt: "사진 업로드 화면",
    tip: {
      label: "사진 팁",
      text: "정면을 바라보는 밝은 셀카일수록 결과가 더 자연스러워요.",
    },
  },
  {
    number: "3",
    label: "얼굴 맞추기",
    title: "프레임 안에서\n얼굴 위치를 맞춰주세요.",
    description: "확대, 축소, 이동으로 눈과 얼굴이 프레임 안에 자연스럽게 들어오면 됩니다.",
    image: "/images/how-to/step-3.png",
    imageAlt: "프레임 조정 화면",
    tip: null,
  },
  {
    number: "4",
    label: "결과 저장하기",
    title: "생성이 끝나면\n저장하거나 공유하세요.",
    description: "결과를 보고 저장, 공유, 다시하기 중 원하는 흐름으로 이어가면 됩니다.",
    image: "/images/how-to/step-4.png",
    imageAlt: "결과 저장 화면",
    tip: null,
  },
];

const TOTAL = GUIDE_STEPS.length;

export default function HowToPage() {
  return (
    <main className="min-h-screen bg-[#F6F7FB] text-[#1F2A44]">
      <header className="sticky top-0 z-40 border-b border-[#E8ECF5] bg-[#F6F7FB]/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[520px] items-center justify-between px-5 sm:px-7">
          <Link
            href="/studio"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[24px] font-light text-[#2A3550] transition-colors hover:bg-[#EEF2FA]"
            aria-label="스튜디오로 돌아가기"
          >
            ×
          </Link>
          <p className="text-[13px] font-bold tracking-[0.02em] text-[#4B82FF]">사용방법</p>
          <div className="w-10" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[420px] flex-col px-6 pb-24 pt-6 sm:max-w-[520px] sm:px-8">
        <section className="rounded-[24px] border border-[#E8ECF5] bg-white p-6 shadow-[0_16px_40px_rgba(122,139,179,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4B82FF]">Quick Guide</p>
          <h1
            className="font-['Pretendard'] mt-3 whitespace-pre-line text-[26px] font-extrabold leading-[1.3] tracking-[-0.03em] text-[#1F2A44] sm:text-[30px]"
          >
            {"4단계로 끝내는\nStyleDrop 시작법"}
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-[#6B7892]">
            카드 고르기부터 결과 저장까지, 한 번에 눈으로 확인해요.
          </p>
          <div className="mt-5 flex items-center gap-2">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <span
                key={i}
                className="h-[6px] flex-1 rounded-full bg-gradient-to-r from-[#4B82FF] to-[#7FA8FF]"
              />
            ))}
          </div>
          <p className="mt-3 text-[12px] font-bold text-[#90A0BC]">약 1분이면 충분해요</p>
        </section>

        <div className="mt-8 flex flex-col gap-6">
          {GUIDE_STEPS.map((step, index) => (
            <section
              key={step.number}
              className="rounded-[24px] border border-[#E8ECF5] bg-white p-5 shadow-[0_16px_40px_rgba(122,139,179,0.08)] sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                  style={{
                    background: "linear-gradient(135deg, #4B82FF 0%, #7FA8FF 100%)",
                    boxShadow: "0 8px 20px rgba(75,130,255,0.32)",
                  }}
                >
                  {step.number}
                </span>
                <div className="flex flex-col leading-tight">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#90A0BC]">
                    Step {step.number} / {TOTAL}
                  </p>
                  <p className="mt-0.5 text-[14px] font-bold text-[#4B82FF]">{step.label}</p>
                </div>
              </div>

              <h2
                className="font-['Pretendard'] mt-5 whitespace-pre-line text-[22px] font-extrabold leading-[1.38] tracking-[-0.035em] text-[#1F2A44] sm:text-[25px]"
              >
                {step.title}
              </h2>

              <p className="mt-3 text-[14px] leading-7 text-[#6B7892] sm:text-[15px]">
                {step.description}
              </p>

              <div className="mt-5 overflow-hidden rounded-[20px] border border-[#E8ECF5] bg-[linear-gradient(180deg,#FBFCFF_0%,#F2F5FB_100%)]">
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

              {step.tip && (
                <div className="mt-4 flex items-start gap-3 rounded-[16px] bg-[#EAF1FF] p-4">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-[#4B82FF]">
                    i
                  </span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#4B82FF]">
                      {step.tip.label}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[#3A4B6E]">{step.tip.text}</p>
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-[24px] bg-[#1F2A44] p-6 text-white shadow-[0_18px_40px_rgba(31,42,68,0.18)] sm:p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#7FA8FF]">Ready</p>
          <h3
            className="font-['Pretendard'] mt-3 whitespace-pre-line text-[24px] font-extrabold leading-[1.35] tracking-[-0.03em]"
          >
            {"이제 내 차례예요.\n첫 장면을 만들어볼까요?"}
          </h3>
          <p className="mt-3 text-[14px] leading-6 text-white/70">
            마음에 드는 카드를 골라 바로 시작해보세요.
          </p>
          <Link
            href="/studio"
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[16px] bg-white text-[14px] font-extrabold text-[#1F2A44] transition-colors hover:bg-[#F6F7FB]"
          >
            스타일 고르러 가기 →
          </Link>
        </section>
      </div>
    </main>
  );
}
