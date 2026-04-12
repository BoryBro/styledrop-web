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
              <p className="font-semibold text-white/90 mb-1">① 카카오 로그인 시</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>카카오 고유 식별자(ID)</li>
                <li>닉네임, 프로필 사진</li>
                <li>카카오 계정에서 제공되는 이메일(제공된 경우에 한함)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90 mb-1">② 프로필 및 공개 기능 이용 시</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>이용자가 직접 입력한 인스타그램 아이디(선택)</li>
                <li>메인 공개 스토리 게시 여부, 게시 이미지, 게시 시각</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90 mb-1">③ 이미지 및 결과물 생성 시</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>업로드한 원본 사진, 변환 결과 이미지</li>
                <li>AI 오디션용 관상 사진 1장, 씬 사진 3장, 분석 결과, 생성된 스틸컷 이미지</li>
                <li>스타일 ID, 장르, 베리에이션, 생성 시각 등 결과물 메타데이터</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90 mb-1">④ 결제 시</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>결제 수단, 결제 금액, 결제 일시</li>
                <li>결제 식별자, 결제 상태, PG사 정보</li>
                <li>결제 정보는 포트원(PortOne) 및 카카오페이가 처리하며, StyleDrop은 서비스 운영에 필요한 결제 식별 정보만 보관합니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90 mb-1">⑤ 서비스 이용 시 자동 수집</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>로그인 세션 쿠키, 무료 체험 제한 및 기능 유지를 위한 쿠키(Cookie)</li>
                <li>변환 스타일, 이용 기록, 공유 보상 이력, 공개 스토리 참여 이력, 서비스 이벤트 로그</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">2. 개인정보 수집 및 이용 목적</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>카카오 로그인 인증 및 계정 식별</li>
            <li>크레딧 기반 서비스 이용 관리 및 차감·지급 처리</li>
            <li>일반 카드, 퍼스널 컬러, AI 오디션, 스틸컷 등 AI 결과물 생성 및 제공</li>
            <li>마이페이지 최근 결과, 공개 스토리, 공유 기능 제공</li>
            <li>결제 처리 및 환불 대응</li>
            <li>이용 기록 저장, 통계 집계, 운영상 오류 분석 및 악용 방지</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">3. 이미지 데이터 처리</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>업로드된 사진은 AI 이미지 생성·분석·결과 제공 목적으로 사용됩니다.</li>
            <li>이용자가 결과 저장, 최근 기록, 공유, 공개 스토리, AI 오디션 기능을 이용하는 경우 원본 사진, 결과 이미지 또는 관련 메타데이터가 Supabase Storage 및 데이터베이스에 저장될 수 있습니다.</li>
            <li>일반 카드 공유 링크, AI 오디션 공유 링크, 공개 스토리 이미지 등은 공개 URL 형태로 생성될 수 있으며, 해당 URL을 아는 사람은 접근할 수 있습니다.</li>
            <li>이용자가 메인 공개 스토리에 참여하는 경우 생성 이미지와 함께 닉네임, 프로필 사진, 선택 입력한 인스타그램 아이디가 다른 이용자에게 표시될 수 있습니다.</li>
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
                  <td className="py-2 pr-4">AI 이미지 생성 및 분석 처리</td>
                  <td className="py-2">처리 목적 달성 시까지</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Supabase</td>
                  <td className="py-2 pr-4">데이터베이스, 이미지 스토리지, 공개 결과물 저장</td>
                  <td className="py-2">각 항목별 보유기간 또는 삭제 시까지</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">포트원(PortOne)</td>
                  <td className="py-2 pr-4">결제 처리 대행</td>
                  <td className="py-2">관련 법령에 따름</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">카카오페이</td>
                  <td className="py-2 pr-4">간편결제 처리</td>
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
            <li>회원 정보(카카오 ID, 닉네임, 프로필 사진, 이메일): 회원 탈퇴 시까지 보관 후 삭제합니다. 단, 관련 법령상 보관 의무가 있는 경우 해당 기간 동안 별도 보관합니다.</li>
            <li>인스타그램 아이디: 이용자가 직접 삭제·변경하거나 회원 탈퇴 시까지 보관합니다.</li>
            <li>일반 카드 최근 결과 및 저장 이력: 이용자가 개별 삭제하거나 회원 탈퇴 시까지 보관합니다.</li>
            <li>메인 공개 스토리 이미지 및 게시 정보: 이용자가 내리거나 다른 이미지로 교체하거나 회원 탈퇴 시까지 보관합니다.</li>
            <li>AI 오디션 결과, 업로드 사진, 스틸컷, 공유 데이터: 서비스 결과 제공 및 공유 기능 운영을 위해 보관되며 회원 탈퇴 또는 관련 데이터 삭제 처리 시 삭제합니다.</li>
            <li>결제 기록: 전자상거래 등 관련 법령에 따라 5년간 보관할 수 있습니다.</li>
            <li>세션 쿠키: 로그아웃 또는 최대 30일의 쿠키 만료 시점까지 유지될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">6. 공개 범위 및 제3자 열람</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>이용자가 직접 공유 링크를 생성하거나 공개 스토리에 참여한 경우, 해당 결과물은 제3자가 열람할 수 있습니다.</li>
            <li>공개 스토리에는 생성 이미지, 닉네임, 프로필 사진, 선택 입력한 인스타그램 아이디가 함께 노출될 수 있습니다.</li>
            <li>공유 또는 공개 기능은 이용자의 명시적 선택에 의해서만 진행됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">7. 이용자의 권리</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-white/70">
            <li>이용자는 언제든지 개인정보 열람, 수정, 삭제를 요청할 수 있습니다.</li>
            <li>이용자는 마이페이지에서 일부 최근 결과를 직접 삭제하거나 공개 스토리 게시를 내릴 수 있습니다.</li>
            <li>이용자는 회원 탈퇴를 통해 계정 및 회원 기반 저장 데이터를 삭제 요청할 수 있습니다. 다만 법령상 보관 의무가 있는 결제 관련 정보는 예외가 될 수 있습니다.</li>
            <li>관련 요청은 support@styledrop.cloud 로 문의할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">8. 쿠키 사용</h2>
          <p className="text-white/70">로그인 상태 유지, 무료 체험 제한 관리, 서비스 흐름 유지 등을 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나 일부 서비스 이용이 제한될 수 있습니다.</p>
        </section>

        <section className="pt-4 mt-6 border-t border-white/10 text-white/40 text-xs space-y-1">
          <p>본 방침은 2026년 4월 12일부터 시행됩니다. (v2.2)</p>
          <p>개인정보 보호책임자: support@styledrop.cloud</p>
        </section>
      </div>
    </main>
  );
}
