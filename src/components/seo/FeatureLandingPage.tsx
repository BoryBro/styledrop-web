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
  keyword,
  chips,
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
      <section className="border-b border-gray-100 bg-[radial-gradient(circle_at_top,rgba(201,87,26,0.10),transparent_42%)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-14 pt-8 sm:px-8 sm:pt-12">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-[14px] font-semibold text-gray-500 transition-colors hover:text-gray-900">
              ← 돌아가기
            </Link>
            <span className="rounded-full bg-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
              SEO Page
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.3em] text-[#C9571A]">{eyebrow}</p>
                <h1 className="max-w-3xl text-[34px] font-black leading-[1.08] tracking-[-0.04em] text-gray-950 sm:text-[48px]">
                  {title}
                </h1>
                <p className="mt-5 max-w-2xl text-[16px] leading-7 text-gray-600 sm:text-[17px]">
                  {description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#FFF4EC] px-3 py-1 text-[12px] font-bold text-[#C9571A]">
                  메인 키워드: {keyword}
                </span>
                {chips.map((chip) => (
                  <span key={chip} className="rounded-full bg-gray-100 px-3 py-1 text-[12px] font-bold text-gray-600">
                    {chip}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#C9571A] px-6 text-[15px] font-black text-white transition-colors hover:bg-[#B34A12]"
                >
                  {ctaLabel}
                </Link>
                <Link
                  href={secondaryHref}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-gray-200 bg-white px-6 text-[15px] font-bold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-950"
                >
                  {secondaryLabel}
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] bg-[#0C0C0C] p-6 text-white shadow-[0_36px_80px_rgba(0,0,0,0.18)]">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-gray-400">Why StyleDrop</p>
              <h2 className="mt-3 text-[24px] font-black leading-[1.18] tracking-[-0.03em]">{introTitle}</h2>
              <p className="mt-4 text-[15px] leading-7 text-gray-300">{introBody}</p>
              <div className="mt-6 flex flex-col gap-3">
                {points.map((point, index) => (
                  <div key={point} className="flex gap-3">
                    <span className="mt-0.5 text-[12px] font-black text-[#C9571A]">{String(index + 1).padStart(2, "0")}</span>
                    <p className="text-[14px] leading-6 text-gray-200">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.05)]">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-400">Guide</p>
              <h2 className="mt-3 text-[20px] font-black leading-[1.2] tracking-[-0.03em] text-gray-950">{section.title}</h2>
              <p className="mt-3 text-[15px] leading-7 text-gray-600">{section.body}</p>
            </article>
          ))}
        </div>

        <section className="border-t border-gray-100 pt-12">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">FAQ</p>
            <h2 className="mt-3 text-[32px] font-black tracking-[-0.04em] text-gray-950">검색 전에 많이 묻는 내용</h2>
          </div>
          <div className="mt-8 border-t border-gray-100">
            {faq.map((item) => (
              <article key={item.title} className="border-b border-gray-100 py-5">
                <h3 className="text-[18px] font-bold tracking-[-0.02em] text-gray-950">{item.title}</h3>
                <p className="mt-2 max-w-3xl text-[15px] leading-7 text-gray-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] bg-[#F8F8F8] px-6 py-8">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-gray-400">Next Step</p>
          <p className="mt-3 text-[17px] leading-7 text-gray-700">
            더 자세한 사용 흐름은 <Link href="/how-to" className="font-bold text-[#C9571A]">사용방법</Link>,
            {" "}
            정책은 <Link href="/faq" className="font-bold text-[#C9571A]">FAQ</Link>,
            {" "}
            <Link href="/terms" className="font-bold text-[#C9571A]">이용약관</Link>,
            {" "}
            <Link href="/privacy" className="font-bold text-[#C9571A]">개인정보처리방침</Link>에서 확인할 수 있습니다.
          </p>
        </section>
      </section>
    </main>
  );
}
