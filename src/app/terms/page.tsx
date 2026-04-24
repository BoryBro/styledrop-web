import Link from 'next/link';
import { REFUND_WINDOW_DAYS } from "@/lib/payment-policy";
import { GoogleAd } from "@/components/ads/GoogleAd";
import { ADSENSE_PAGE_SLOTS } from "@/lib/adsense";

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
          <p>본 약관은 StyleDrop(이하 &quot;서비스&quot;)이 제공하는 AI 이미지 생성·변환, 퍼스널 컬러, AI 오디션, 공유, 공개 스토리, 크레딧 결제 및 관련 부가 기능의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임 사항을 정함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 2조 (서비스 내용)</h2>
          <p>StyleDrop은 생성형 AI를 기반으로 사용자의 사진을 다양한 콘셉트 결과물로 변환하고, 저장·공유·공개 전시 기능을 제공하는 웹 서비스입니다.</p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-white/70">
            <li>일반 카드 이미지 변환 및 실험실 기능</li>
            <li>퍼스널 컬러 분석 및 관련 추천 기능</li>
            <li>AI 오디션 분석, 결과 리포트, 카드 꾸미기, 스틸컷 생성 기능</li>
            <li>마이페이지 내 최근 결과 확인, 저장, 삭제, 공유 기능</li>
            <li>메인 공개 스토리 및 공개 공유 페이지 기능</li>
            <li>비로그인 이용자: 제한된 무료 체험 가능 (기능 및 워터마크 정책은 시점별로 다를 수 있음)</li>
            <li>카카오 로그인 신규 가입 이용자: 1크레딧 무료 지급</li>
            <li>외부 API 상태, 운영 정책, 실험실 공개 여부에 따라 일부 기능은 추가·변경·중단될 수 있습니다.</li>
            <li>생성형 AI 특성상 결과물의 품질, 정확성, 심미성, 적합성은 100% 보장되지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 3조 (회원가입 및 계정)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>로그인 회원 기능은 카카오 로그인을 통해 제공됩니다.</li>
            <li>이용자는 본인 또는 적법한 권한이 있는 계정과 사진만 사용해야 합니다.</li>
            <li>계정 정보의 관리 책임은 이용자에게 있으며, 제3자 무단 사용이 의심되는 경우 즉시 서비스에 알려야 합니다.</li>
            <li>서비스는 운영상 필요 시 비회원 기능, 회원 전용 기능, 공개 기능의 범위를 조정할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 4조 (크레딧 및 결제)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>크레딧은 서비스 내 AI 기능 이용에 사용되는 디지털 이용권입니다.</li>
            <li>일반 카드 이미지 변환 및 일부 유사 기능은 원칙적으로 1회 이용당 1크레딧이 차감됩니다.</li>
            <li>AI 오디션은 시작 시점에 5크레딧이 차감되며, 현재 운영 기준으로 결과 리포트 및 스틸컷 생성 패키지가 포함됩니다.</li>
            <li>신규 가입 시 1크레딧이 무료로 지급됩니다.</li>
            <li>크레딧 패키지 가격은 서비스 내 상점 페이지에 명시되며, 사전 고지 후 변경될 수 있습니다.</li>
            <li>결제는 카카오페이를 통해 포트원(PortOne)으로 처리됩니다.</li>
            <li>크레딧은 결제 완료 즉시 계정에 지급됩니다.</li>
            <li>크레딧의 현금 환급은 불가하며, 타 계정으로의 양도도 불가합니다.</li>
            <li>유상 충전 크레딧의 유효기간은 충전일로부터 1년입니다.</li>
            <li>무상·보상성 크레딧은 운영 공지 및 이벤트 조건이 우선 적용되며 지급·회수·만료 조건이 달라질 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 5조 (결과물 저장, 공유 및 공개)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>이용자는 생성된 결과물을 마이페이지, 최근 결과, 공유 페이지, 공개 스토리 등 서비스가 제공하는 범위 안에서 저장·열람·공유할 수 있습니다.</li>
            <li>이용자가 공개 스토리 또는 공유 기능을 직접 사용하는 경우, 생성 이미지·닉네임·프로필 사진·선택 입력한 인스타그램 아이디 등이 다른 이용자 또는 링크 방문자에게 공개될 수 있습니다.</li>
            <li>공개 스토리에 게시한 이미지는 이용자가 교체하거나 내릴 수 있으며, 공유 링크 및 공개 URL은 해당 주소를 아는 제3자가 접근할 수 있습니다.</li>
            <li>AI 오디션 결과, 스틸컷, 카드 편집 결과물은 서비스 구조상 저장·공유용 데이터와 함께 보관될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 6조 (환불 정책)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>미사용 크레딧에 한하여 결제일로부터 {REFUND_WINDOW_DAYS}일 이내 전액 환불 요청이 가능합니다.</li>
            <li>크레딧을 일부라도 사용한 경우, 사용분 및 관련 수수료·정산 비용 등을 공제한 후 잔여 금액만 환불될 수 있습니다.</li>
            <li>환불 요청은 고객센터(support@styledrop.cloud)를 통해 접수하며, 처리 기간은 영업일 기준 3~5일입니다.</li>
            <li>결제 오류 또는 시스템 장애로 인한 이중 결제의 경우 전액 환불 처리합니다.</li>
            <li>디지털 콘텐츠 특성상 결제일로부터 7일이 경과했거나, 공제 후 환불 가능 금액이 없는 경우 환불이 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 7조 (이용자의 의무)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>타인의 초상권, 저작권 등 지적재산권을 침해하는 사진을 업로드해서는 안 됩니다.</li>
            <li>타인의 얼굴, 계정, 인스타그램 아이디, 공개 가능한 권한이 없는 결과물을 무단으로 공개하거나 전시해서는 안 됩니다.</li>
            <li>음란물, 폭력성, 불법 콘텐츠 또는 타인의 명예를 훼손하는 목적의 이용은 금지됩니다.</li>
            <li>변환 결과물로 인해 발생하는 제3자와의 분쟁 및 법적 책임은 이용자 본인에게 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 8조 (지식재산권 및 이용허락)</h2>
          <ul className="list-disc pl-5 space-y-2 text-white/70">
            <li>이용자는 업로드한 사진 및 입력한 정보에 대해 적법한 권리를 보유해야 합니다.</li>
            <li>서비스는 결과물 생성, 저장, 표시, 공유 링크 제공, 공개 스토리 게시 등 이용자가 선택한 기능을 수행하기 위한 범위에서 필요한 최소한의 이용권한을 가집니다.</li>
            <li>공개 기능에 자발적으로 참여한 결과물은 해당 기능 운영 및 노출을 위해 서비스 화면에 표시될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3 text-white">제 9조 (책임 한계 및 면책)</h2>
          <p>StyleDrop은 AI 생성 결과물의 예술적 가치, 정확성, 상업적 적합성, 특정 목적 적합성에 대해 보증 책임을 지지 않습니다. 서비스는 외부 API, 결제사, 클라우드 인프라, 실험 기능 공개 여부 등에 따라 지연 또는 중단될 수 있으며, 이용자가 저장 또는 삭제하지 않은 결과물의 손실·누락에 대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</p>
        </section>

        <section className="pt-4 mt-6 border-t border-white/10 text-white/40 text-xs space-y-1">
          <p>본 약관은 2026년 4월 12일부터 시행됩니다. (v2.2)</p>
          <p>문의: support@styledrop.cloud</p>
        </section>
      </div>

      <div className="mt-6">
        <GoogleAd
          slot={ADSENSE_PAGE_SLOTS.legal}
          theme="light"
        />
      </div>
    </main>
  );
}
