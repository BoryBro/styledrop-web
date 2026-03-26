import Link from 'next/link';

export default function TermsOfService() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-16 flex flex-col min-h-screen text-white/90">
      <div className="mb-8">
        <Link href="/" className="text-point hover:text-[#B34A12] text-sm font-semibold transition-colors flex items-center gap-2 w-fit">
          &larr; 돌아가기
        </Link>
      </div>
      
      <h1 className="text-3xl font-extrabold mb-8 text-white">이용약관</h1>
      
      <div className="space-y-6 text-sm md:text-base leading-relaxed break-keep bg-card/50 p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl">
        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 1조 (목적)</h2>
          <p>본 약관은 사용자가 StyleDrop(이하 "서비스")이 제공하는 AI 초고해상도 업스케일링 및 조명 변환 기능을 이용함에 있어, 본 서비스와 사용자 간의 기본적인 권리, 의무 규정, 그리고 책임 사항을 명확히 함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 2조 (서비스의 제공 및 한계)</h2>
          <p>StyleDrop은 뛰어난 성능의 Google Gemini AI 모델을 기반으로, 사용자의 셀카나 추억이 담긴 이미지를 특정 스타일로 자유롭게 가공하여 화면에 반환하는 웹 서비스입니다. 기술적인 문제나 외부 API(Google)의 트래픽 상태에 의해 때때로 서비스가 일시 중단될 수 있으며, 생성형 AI의 본질적인 한계상 항상 100% 동일하거나 예측 가능한 결과물의 품질을 확정적으로 보증하지는 못합니다.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 3조 (이용자의 엄격한 의무)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70 mt-3">
            <li>사용자는 타인의 초상권, 저작권, 상표권 등 어떠한 지적재산권도 침해하는 사진을 무단으로 업로드해서는 안 됩니다.</li>
            <li>음란물, 폭력성, 불법적인 콘텐츠 또는 타인에게 정신적 불쾌감 및 심각한 명예훼손을 줄 수 있는 목적의 이미지 악용은 엄격히 금지됩니다.</li>
            <li>현 서비스를 이용해 변형된 결과물을 토대로 일어나는 제3자와의 모든 형태의 분쟁 및 법적 책임은, 원본 이미지를 업로드하고 생성 버튼을 누른 이용자 본인에게 전적으로 귀속됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 4조 (책임 한계 및 면책)</h2>
          <p>StyleDrop팀은 AI 모델이 최종 생성하는 결과물의 예술적 가치, 정확성, 무결성 그리고 그것이 특정 목적에 적합한지에 대하여 보증하는 책임을 지지 아니합니다. 아울러 제반 보안 정책에 따라 업로드된 이미지는 변환 종료 후 즉시 소멸되므로, 사용자는 필히 변환된 최종 결과 이미지를 개별 기기에 바로 저장해야 하며 이로 인한 데이터 로컬 상실에 대해 당사는 면책을 주장할 권리가 있습니다.</p>
        </section>
        
        <section className="pt-4 mt-6 border-t border-white/10 text-white/40 text-xs">
          <p>본 약관 일자는 2026년 3월 26일부터 발효 적용됩니다.</p>
        </section>
      </div>
    </main>
  );
}
