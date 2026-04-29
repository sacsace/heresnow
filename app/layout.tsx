import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "HereNow — 현장 출퇴근 증빙",
  description: "클릭 시점 GPS만 저장하는 멀티 테넌트 출퇴근 증빙",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HereNow", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} min-h-dvh antialiased font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
