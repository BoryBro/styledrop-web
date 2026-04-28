import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "밸런스 100 | StyleDrop",
  description: "100개의 선택으로 나와 비슷한 사람을 찾는 StyleDrop 실험실 카드",
  alternates: {
    canonical: "/balance-100",
  },
};

export default function Balance100Layout({ children }: { children: React.ReactNode }) {
  return children;
}
