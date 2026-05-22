import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "HereNow — 현장 출퇴근 증빙",
  description: "클릭 시점 GPS만 저장하는 멀티 테넌트 출퇴근 증빙",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HereNow", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
  width: "device-width",
  initialScale: 1,
  /** 휴대폰·태블릿에서 화면 회전·노치 대응, 핀치 줌 허용 */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
