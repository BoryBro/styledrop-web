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

const ANDROID_STEPS = [
  "Chrome에서 StyleDrop을 엽니다.",
  "우측 상단 메뉴를 누릅니다.",
  "\"홈 화면에 추가\" 또는 \"앱 설치\"를 선택합니다.",
  "\"추가\"를 누르면 홈 화면에 바로가기 아이콘이 생성됩니다.",
] as const;

const BENEFITS = [
  "브라우저를 다시 찾지 않아도 바로 실행할 수 있습니다.",
  "자주 쓰는 기능까지 한 번에 더 빠르게 접근할 수 있습니다.",
  "홈 화면에서 실행하면 앱처럼 단독 화면으로 열릴 수 있습니다.",
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
        <section className="rounded-[32px] border border-[#C9571A]/20 bg-[radial-gradient(circle_at_top,rgba(201,87,26,0.18),transparent_42%),linear-gradient(180deg,#17110E_0%,#0A0A0A_100%)] px-5 py-6">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#C9571A]">Install Guide</p>
          <h1 className="mb-2 text-[28px] font-black leading-tight">홈 화면에 추가하고 앱처럼 사용하세요</h1>
          <p className="text-[14px] leading-relaxed text-white/65">
            App Store나 Play Store 설치 없이도 StyleDrop을 홈 화면에 꺼내둘 수 있습니다.
          </p>
          <div className="mt-5 grid gap-2">
            {BENEFITS.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[13px] leading-relaxed text-white/80">{item}</p>
              </div>
            ))}
          </div>
        </section>

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

        <section id="android" className="rounded-[28px] border border-white/10 bg-[#111] px-5 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#C9571A]">Android</p>
              <p className="mt-1 text-[20px] font-black">Chrome에서 추가</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-white/60">설치 가능</span>
          </div>
          <div className="flex flex-col gap-3">
            {ANDROID_STEPS.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9571A] text-[13px] font-black text-white">
                  {index + 1}
                </div>
                <p className="text-[14px] leading-relaxed text-white/80">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#C9571A]/15 bg-[#C9571A]/8 px-4 py-3">
            <p className="text-[12px] font-bold text-[#F3B38F]">기기에 따라 앱 설치 대신 홈 화면에 추가로 표기될 수 있습니다.</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#111] px-5 py-5">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-[#C9571A]">Quick Access</p>
          <p className="mb-4 text-[14px] leading-relaxed text-white/70">
            홈 화면에 추가한 뒤에는 마치 앱처럼 한 번에 StyleDrop으로 들어올 수 있습니다.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/studio"
              className="flex w-full items-center justify-center rounded-2xl bg-[#C9571A] px-4 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#B34A12]"
            >
              StyleDrop 열기
            </Link>
            <Link
              href="/mypage"
              className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] font-bold text-white/80 transition-colors hover:bg-white/10"
            >
              마이페이지로 돌아가기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
