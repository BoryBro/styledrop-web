import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "홈 화면에 추가 | StyleDrop",
  description: "아이폰과 안드로이드에서 StyleDrop을 홈 화면에 추가하는 방법을 안내합니다.",
};

const IOS_STEPS = [
  {
    title: "Safari에서 StyleDrop을 엽니다.",
    desc: "아이폰에서는 Safari에서 열어야 홈 화면 추가 메뉴가 가장 안정적으로 보입니다.",
  },
  {
    title: "하단 공유 버튼을 누릅니다.",
    desc: "브라우저 하단 가운데 근처의 공유 아이콘을 눌러 메뉴를 열어주세요.",
  },
  {
    title: "\"홈 화면에 추가\"를 선택합니다.",
    desc: "공유 메뉴를 아래로 내려서 \"홈 화면에 추가\"를 고른 뒤, 이름을 확인하고 \"추가\"를 누르면 됩니다.",
  },
] as const;

const IOS_STEP_IMAGES = [
  "/install-guide/ios-step-1.jpg",
  "/install-guide/ios-step-2.jpg",
  "/install-guide/ios-step-3.jpg",
] as const;

export default function InstallAppPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[#1a1a1a] bg-[#0A0A0A]/95 px-4 backdrop-blur">
        <Link href="/mypage" className="flex items-center gap-1.5 text-white/50 transition-colors hover:text-white">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link href="/" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">
          StyleDrop
        </Link>
        <div className="w-8" />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 pb-16">
        <section id="ios" className="rounded-[28px] border border-white/10 bg-[#111] px-5 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C9571A]">iPhone</p>
              <p className="mt-1 text-[20px] font-black">Safari에서 추가</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-white/60">권장 브라우저</span>
          </div>
          <div className="flex flex-col gap-3">
            {IOS_STEPS.map((step, index) => (
              <div key={step.title} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                <div className="flex gap-3 px-4 py-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9571A] text-[13px] font-black text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-relaxed text-white">{step.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/65">{step.desc}</p>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={IOS_STEP_IMAGES[index]}
                  alt={`아이폰 홈 화면 추가 안내 ${index + 1}`}
                  className="w-full border-t border-white/8 bg-black object-cover"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#C9571A]/15 bg-[#C9571A]/8 px-4 py-3">
            <p className="text-[12px] font-bold text-[#F3B38F]">Safari에서 열어야 홈 화면에 추가 메뉴가 가장 안정적으로 보입니다.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
