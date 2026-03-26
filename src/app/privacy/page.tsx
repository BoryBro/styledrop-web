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
      
      <div className="space-y-6 text-sm md:text-base leading-relaxed break-keep bg-card/50 p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl">
        <section>
          <h2 className="text-xl font-bold mb-3 text-white">1. 수집하는 개인정보</h2>
          <p>StyleDrop은 회원가입이나 로그인을 요구하지 않으며, 사용자를 식별할 수 있는 어떠한 형태의 개인정보(이름, 연락처, 이메일 등)도 수집하지 않습니다.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">2. 이미지 데이터의 처리 및 보관</h2>
          <p>서비스 이용을 위해 업로드하신 모든 사진 파일은 오직 인공지능(AI)을 통한 이미지 변환 처리를 위해서만 임시로 사용됩니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-white/70">
            <li>업로드된 원본 이미지는 당사 서버나 외장 데이터베이스에 무단으로 복사하거나 저장되지 않습니다.</li>
            <li>생성이 완료된 결과물 이미지 또한 서버에 보관되지 않으며, 변환이 끝난 즉시 시스템 메모리에서 완전히 파기됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">3. 제3자 제공 및 위탁 (Google Gemini AI)</h2>
          <p>StyleDrop은 핵심 이미지 스타일 변환 엔진으로 구글의 최고 성능 비전 AI인 Google Gemini API를 활용합니다. 사용자가 업로드한 이미지는 화질 개선 및 스타일 튜닝 목적 하에 구글 서버로 안전하게 암호화 전송되며, 처리 완료 후 즉시 파기됩니다. Google의 안전한 데이터 수집 정책에 따라 전송된 사용자의 이미지는 외부 AI 모델의 무단 학습 용도로 재활용되지 않습니다.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">4. 쿠키 및 추적 기술</h2>
          <p>우리는 비상업적 목적으로 운영되는 서비스인 만큼, 무단으로 사용자 행동을 추적하기 위한 쿠키(Cookie)나 써드파티 트래커를 심지 않습니다. 오직 서비스의 기본적인 상태(UI 테마 등)를 위한 클라이언트 상태 정도만 다룰 수 있습니다.</p>
        </section>

        <section className="pt-4 mt-6 border-t border-white/10 text-white/40 text-xs">
          <p>본 방침은 2026년 3월 26일부터 제정되어 시행됩니다.</p>
        </section>
      </div>
    </main>
  );
}
