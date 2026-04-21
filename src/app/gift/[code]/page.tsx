import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import GiftCodePanel from "@/components/gift/GiftCodePanel";

export const dynamic = "force-dynamic";

type GiftCodePageParams = {
  params: Promise<{ code: string }>;
};

type GiftCodeRow = {
  code: string;
  credits: number;
  status: string;
  expires_at: string;
  used_at: string | null;
  created_by: string;
};

async function loadGiftCode(code: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: gift } = await supabase
    .from("gift_codes")
    .select("code, credits, status, expires_at, used_at, created_by")
    .eq("code", code)
    .maybeSingle<GiftCodeRow>();

  if (!gift) return null;

  const { data: sender } = await supabase
    .from("users")
    .select("nickname")
    .eq("id", gift.created_by)
    .maybeSingle<{ nickname: string | null }>();

  return {
    gift,
    senderName: sender?.nickname?.trim() || null,
  };
}

export default async function GiftCodePage({ params }: GiftCodePageParams) {
  const { code } = await params;
  const payload = await loadGiftCode(code);

  if (!payload) notFound();

  const { gift, senderName } = payload;
  const expiryDate = gift.expires_at
    ? new Date(gift.expires_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const isExpired = new Date(gift.expires_at) < new Date();
  const isUsed = gift.status === "used";

  let title = senderName ? `${senderName}님이 선물 코드를 보냈어요!` : "친구가 선물 코드를 보냈어요!";
  let subtitle = `크레딧 ${gift.credits}회 선물 코드예요`;
  let expiryText = `유효기간: ${expiryDate}까지`;
  let topEmoji = "🎁";
  let helperLines = [
    "1. 코드 복사하기",
    "2. 마이페이지로 이동하기",
    "3. 선물 코드 입력칸에 붙여넣기",
  ];

  if (isUsed) {
    title = "이미 사용된 선물 코드예요";
    subtitle = "이 코드는 이미 등록이 끝났어요.";
    expiryText = gift.used_at
      ? `사용 완료: ${new Date(gift.used_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`
      : "이미 사용 완료된 코드예요.";
    topEmoji = "✅";
    helperLines = [
      "이미 등록이 끝난 선물 코드입니다.",
      "다른 코드를 받았다면 마이페이지에서 등록해보세요.",
    ];
  } else if (isExpired) {
    title = "만료된 선물 코드예요";
    subtitle = "유효기간이 지나 더 이상 등록할 수 없어요.";
    topEmoji = "⏰";
    helperLines = [
      "유효기간이 지난 코드는 등록할 수 없습니다.",
      "보낸 사람에게 새 코드를 요청해주세요.",
    ];
  }

  return (
    <GiftCodePanel
      title={title}
      subtitle={subtitle}
      expiryText={expiryText}
      giftCode={gift.code}
      topEmoji={topEmoji}
      helperLines={helperLines}
      actions={[
        {
          label: "마이페이지로 바로가기",
          href: "/mypage",
          className: "w-full h-[48px] rounded-xl bg-[#C9571A] text-white font-bold text-[14px] flex items-center justify-center",
        },
      ]}
    />
  );
}
