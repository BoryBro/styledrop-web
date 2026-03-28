import type { Metadata } from "next";
import Script from "next/script";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["700"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "StyleDrop",
  description: "사진 한 장, 감성은 AI가",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${montserrat.variable}`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
