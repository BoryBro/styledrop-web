import type { Metadata } from "next";
import HowToFlow from "@/components/how-to/HowToFlow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "사용방법",
  description: "StyleDrop에서 카드 선택부터 업로드, 프레임 조정, 저장과 공유까지 빠르게 보는 사용 가이드 페이지.",
};

export default function HowToPage() {
  return <HowToFlow mode="page" />;
}
