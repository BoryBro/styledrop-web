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

      <div className="space-y-8 text-sm md:text-base leading-relaxed break-keep bg-card/50 p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl">

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 1조 (목적)</h2>
          <p>본 약관은 StyleDrop(이하 "서비스")이 제공하는 AI 이미지 변환 서비스 및 크레딧 기반 유료 서비스 이용에 관하여 서비스와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 2조 (서비스 내용)</h2>
          <p>StyleDrop은 Google Gemini AI 모델을 기반으로 사용자의 사진에 다양한 스타일(플래시 필터, 오토바이 셀카, 픽셀 캐릭터, 조선시대 농부 등)을 적용하여 변환 이미지를 제공하는 웹 서비스입니다.</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-white/70">
            <li>비로그인 이용자: 1회 무료 체험 가능 (워터마크 포함)</li>
            <li>카카오 로그인 신규 가입 이용자: 3크레딧 무료 지급</li>
            <li>크레딧 보유 이용자: 1크레딧 차감 후 워터마크 없는 고화질 이미지 즉시 제공</li>
            <li>외부 API 상태에 따라 서비스가 일시 중단될 수 있으며, 생성형 AI 특성상 결과물의 품질을 100% 보증하지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 3조 (크레딧 및 결제)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>크레딧은 AI 이미지 변환(1크레딧 = 1회 변환)에 사용되는 서비스 내 가상 화폐입니다.</li>
            <li>신규 가입 시 3크레딧이 무료로 지급됩니다.</li>
            <li>크레딧 패키지 가격은 서비스 내 상점 페이지에 명시되며, 사전 고지 후 변경될 수 있습니다.</li>
            <li>결제는 카카오페이를 통해 포트원(PortOne)으로 처리됩니다.</li>
            <li>크레딧은 결제 완료 즉시 계정에 지급됩니다.</li>
            <li>크레딧의 현금 환급은 불가하며, 타 계정으로의 양도도 불가합니다.</li>
            <li>크레딧의 유효기간은 없으며, 잔액은 계정 유지 기간 동안 보존됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 4조 (환불 정책)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>미사용 크레딧에 한하여 결제일로부터 7일 이내 전액 환불 요청이 가능합니다.</li>
            <li>크레딧을 1회라도 사용한 경우, 잔여 크레딧에 대한 부분 환불은 불가합니다.</li>
            <li>환불 요청은 고객센터(support@styledrop.cloud)를 통해 접수하며, 처리 기간은 영업일 기준 3~5일입니다.</li>
            <li>결제 오류 또는 시스템 장애로 인한 이중 결제의 경우 전액 환불 처리합니다.</li>
            <li>디지털 콘텐츠의 특성상 크레딧이 소진된 경우 환불이 불가함을 동의한 것으로 간주합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 5조 (이용자의 의무)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>타인의 초상권, 저작권 등 지적재산권을 침해하는 사진을 업로드해서는 안 됩니다.</li>
            <li>음란물, 폭력성, 불법 콘텐츠 또는 타인의 명예를 훼손하는 목적의 이용은 금지됩니다.</li>
            <li>변환 결과물로 인해 발생하는 제3자와의 분쟁 및 법적 책임은 이용자 본인에게 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 6조 (책임 한계 및 면책)</h2>
          <p>StyleDrop은 AI 생성 결과물의 예술적 가치, 정확성에 대해 보증 책임을 지지 않습니다. 업로드된 이미지는 변환 처리 후 즉시 삭제되며, 미저장으로 인한 데이터 손실에 대해 책임지지 않습니다.</p>
        </section>

        <section className="pt-4 mt-6 border-t border-white/10 text-white/40 text-xs space-y-1">
          <p>본 약관은 2026년 3월 31일부터 시행됩니다. (v2.0)</p>
          <p>문의: support@styledrop.cloud</p>
        </section>
      </div>
    </main>
  );
}
