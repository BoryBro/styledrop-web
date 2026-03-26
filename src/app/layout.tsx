import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
