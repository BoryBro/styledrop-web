import type { Metadata } from "next";
import Script from "next/script";
import { Montserrat, Boldonse, Outfit, Unbounded } from "next/font/google";
import "./globals.css";
import { RevisitTracker } from "./_RevisitTracker";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-montserrat" });
const boldonse = Boldonse({ subsets: ["latin"], weight: "400", variable: "--font-boldonse" });
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700", "900"], variable: "--font-outfit" });
const unbounded = Unbounded({ subsets: ["latin"], weight: ["600"], variable: "--font-unbounded" });

const BASE_URL = "https://www.styledrop.cloud";
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "StyleDrop — AI 스타일 분석",
    template: "%s | StyleDrop",
  },
  description: "사진 한 장으로 AI가 나에게 맞는 스타일을 분석해드려요. 퍼스널컬러, 얼굴형, 패션 추천까지.",
  keywords: ["AI 스타일 분석", "퍼스널컬러", "AI 패션 추천", "얼굴형 분석", "스타일드랍", "StyleDrop"],
  authors: [{ name: "StyleDrop" }],
  creator: "StyleDrop",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: BASE_URL,
    siteName: "StyleDrop",
    title: "StyleDrop — AI 스타일 분석",
    description: "사진 한 장으로 AI가 나에게 맞는 스타일을 분석해드려요.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "StyleDrop — AI 스타일 분석",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StyleDrop — AI 스타일 분석",
    description: "사진 한 장으로 AI가 나에게 맞는 스타일을 분석해드려요.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${montserrat.variable} ${boldonse.variable} ${outfit.variable} ${unbounded.variable}`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <RevisitTracker />
        {children}
        {ADSENSE_CLIENT ? (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        ) : null}
        <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
