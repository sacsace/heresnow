import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  "https://heresnow-production.up.railway.app"
).replace(/\/+$/, "");

const SITE_NAME = "HeresNow";
const DEFAULT_TITLE = "HeresNow 현장 출퇴근 증빙";
const DEFAULT_DESCRIPTION =
  "HeresNow는 클릭 시점의 GPS만 저장하는 멀티 테넌트 출퇴근 증빙 SaaS입니다. 본인 얼굴 인식, 출장·야간 근무, 회사별 시간대·근무일 설정과 관리자 통계를 제공합니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "HeresNow",
    "출퇴근",
    "근태 관리",
    "GPS 출퇴근",
    "얼굴 인식 출근",
    "현장 근태",
    "멀티 테넌트 SaaS",
    "attendance",
    "time tracking",
    "geofence",
    "face recognition check-in",
  ],
  authors: [{ name: "MS Ventures" }],
  creator: "MS Ventures",
  publisher: "MS Ventures",
  category: "business",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  alternates: {
    canonical: "/",
    languages: {
      ko: "/",
      en: "/",
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "ko_KR",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/favicon.png",
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/favicon.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  referrer: "origin-when-cross-origin",
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
