import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-16 flex flex-col min-h-screen text-white/90">
      <div className="mb-8">
        <Link href="/" className="text-point hover:text-[#B34A12] text-sm font-semibold transition-colors flex items-center gap-2 w-fit">
          &larr; 돌아가기
        </Link>
      </div>

      <h1 className="text-3xl font-extrabold mb-8 text-white">개인정보처리방침</h1>

      <div className="space-y-8 text-sm md:text-base leading-relaxed break-keep bg-card/50 p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl">

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">1. 수집하는 개인정보 항목</h2>
          <p className="mb-3">StyleDrop은 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.</p>
          <div className="space-y-3 text-white/70">
            <div>
              <p className="font-semibold text-white/90 mb-1">① 카카오 로그인 시 (선택적)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>카카오 고유 식별자(ID)</li>
                <li>닉네임, 프로필 사진</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90 mb-1">② 결제 시</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>결제 수단, 결제 금액, 결제 일시</li>
                <li>결제 정보는 포트원(PortOne) 및 각 PG사(카카오페이·토스페이·네이버페이)가 처리하며, StyleDrop은 결제 식별자만 보관합니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90 mb-1">③ 서비스 이용 시 자동 수집</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>이용 횟수 제한을 위한 쿠키(Cookie)</li>
                <li>변환 스타일 및 이용 기록 (로그인 사용자에 한함, Supabase 저장)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">2. 개인정보 수집 및 이용 목적</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>서비스 이용 횟수 관리 및 무료/유료 기능 구분</li>
            <li>크레딧 충전 및 이용 내역 관리</li>
            <li>결제 처리 및 환불 대응</li>
            <li>이용 기록 저장 및 마이페이지 기능 제공</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">3. 이미지 데이터 처리</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>업로드된 사진은 AI 이미지 변환 처리 목적으로만 사용됩니다.</li>
            <li>원본 이미지는 서버에 저장되지 않으며, 변환 완료 후 즉시 파기됩니다.</li>
            <li>변환 결과 이미지는 공유 기능 이용 시에 한해 Supabase Storage에 임시 저장되며, 공유 링크 만료 후 삭제됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">4. 제3자 제공 및 처리 위탁</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-white/60 font-semibold">수탁사</th>
                  <th className="text-left py-2 pr-4 text-white/60 font-semibold">위탁 업무</th>
                  <th className="text-left py-2 text-white/60 font-semibold">보유 기간</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Google (Gemini API)</td>
                  <td className="py-2 pr-4">AI 이미지 변환 처리</td>
                  <td className="py-2">처리 후 즉시 파기</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Supabase</td>
                  <td className="py-2 pr-4">데이터베이스, 이미지 스토리지</td>
                  <td className="py-2">회원 탈퇴 시 삭제</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">포트원(PortOne)</td>
                  <td className="py-2 pr-4">결제 처리 대행</td>
                  <td className="py-2">관련 법령에 따름</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">카카오</td>
                  <td className="py-2 pr-4">소셜 로그인 인증</td>
                  <td className="py-2">연동 해제 시 삭제</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">5. 개인정보 보유 및 파기</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>회원 정보: 서비스 탈퇴 시까지 보관 후 즉시 파기</li>
            <li>결제 기록: 전자상거래법에 따라 5년 보관</li>
            <li>이용 기록: 1년 보관 후 파기</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">6. 이용자의 권리</h2>
          <p className="text-white/70">이용자는 언제든지 개인정보 열람, 수정, 삭제를 요청할 수 있으며 카카오 계정 연동 해제를 통해 수집을 중단할 수 있습니다. 요청은 support@styledrop.cloud 로 문의해 주세요.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">7. 쿠키 사용</h2>
          <p className="text-white/70">서비스 이용 횟수 제한 및 로그인 상태 유지를 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 서비스 이용이 제한될 수 있습니다.</p>
        </section>

        <section className="pt-4 mt-6 border-t border-white/10 text-white/40 text-xs space-y-1">
          <p>본 방침은 2026년 3월 31일부터 시행됩니다.</p>
          <p>개인정보 보호책임자: support@styledrop.cloud</p>
        </section>
      </div>
    </main>
  );
}
