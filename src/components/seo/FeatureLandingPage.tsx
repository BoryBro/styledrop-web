import Link from "next/link";

type SectionCard = {
  title: string;
  body: string;
};

type FeatureLandingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  keyword: string;
  chips: string[];
  ctaHref: string;
  ctaLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  introTitle: string;
  introBody: string;
  points: string[];
  sections: SectionCard[];
  faq: SectionCard[];
};

export default function FeatureLandingPage({
  eyebrow,
  title,
  description,
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  introTitle,
  introBody,
  points,
  sections,
  faq,
}: FeatureLandingPageProps) {
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* ── 헤더 ── */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-8 sm:px-8">
        <Link href="/" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">
          ← StyleDrop
        </Link>
      </div>

      {/* ── 히어로 ── */}
      <section className="mx-auto w-full max-w-3xl px-6 pt-10 pb-14 sm:px-8">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">{eyebrow}</p>
        <h1 className="text-[32px] font-black leading-[1.1] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
          {title}
        </h1>
        <p className="mt-6 text-[16px] leading-[1.8] text-gray-600 max-w-2xl">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={ctaHref}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-950 px-5 text-[14px] font-bold text-white transition-colors hover:bg-gray-800"
          >
            {ctaLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="text-[14px] font-semibold text-gray-500 underline underline-offset-4 hover:text-gray-900 transition-colors"
          >
            {secondaryLabel}
          </Link>
        </div>
      </section>

      {/* ── Why StyleDrop ── */}
      <section className="border-t border-gray-100">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
          <h2 className="text-[22px] font-black leading-[1.2] tracking-[-0.02em] text-gray-950 mb-4">
            {introTitle}
          </h2>
          <p className="text-[15px] leading-[1.8] text-gray-600 mb-8">{introBody}</p>
          <ol className="flex flex-col gap-4">
            {points.map((point, index) => (
              <li key={point} className="flex gap-4 items-start">
                <span className="text-[12px] font-black text-gray-300 tabular-nums leading-6 flex-shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-[15px] leading-[1.7] text-gray-700">{point}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 섹션 카드 ── */}
      <section className="border-t border-gray-100">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
          <div className="flex flex-col divide-y divide-gray-100">
            {sections.map((section) => (
              <article key={section.title} className="py-8 first:pt-0">
                <h2 className="text-[19px] font-black tracking-[-0.02em] text-gray-950 mb-3">
                  {section.title}
                </h2>
                <p className="text-[15px] leading-[1.8] text-gray-600">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
          <h2 className="text-[22px] font-black tracking-[-0.03em] text-gray-950 mb-8">
            자주 묻는 질문
          </h2>
          <div className="flex flex-col divide-y divide-gray-200">
            {faq.map((item) => (
              <article key={item.title} className="py-6 first:pt-0">
                <h3 className="text-[16px] font-bold text-gray-950 mb-2">{item.title}</h3>
                <p className="text-[14px] leading-[1.8] text-gray-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 푸터 링크 ── */}
      <section className="border-t border-gray-100">
        <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-8">
          <p className="text-[14px] leading-[1.8] text-gray-500">
            사용 흐름은 <Link href="/how-to" className="text-gray-900 underline underline-offset-2 hover:text-[#C9571A] transition-colors">사용방법</Link>에서,
            {" "}정책은 <Link href="/faq" className="text-gray-900 underline underline-offset-2 hover:text-[#C9571A] transition-colors">FAQ</Link>,
            {" "}<Link href="/terms" className="text-gray-900 underline underline-offset-2 hover:text-[#C9571A] transition-colors">이용약관</Link>,
            {" "}<Link href="/privacy" className="text-gray-900 underline underline-offset-2 hover:text-[#C9571A] transition-colors">개인정보처리방침</Link>에서 확인할 수 있습니다.
          </p>
        </div>
      </section>

    </main>
  );
}
