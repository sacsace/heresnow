import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  "https://www.heresnow.in"
).replace(/\/+$/, "");

const SITE_NAME: Record<Locale, string> = {
  ko: "히어스나우",
  en: "HeresNow",
};
const DEFAULT_TITLE: Record<Locale, string> = {
  ko: "히어스나우 현장 출퇴근 증빙",
  en: "HeresNow Field Attendance Proof",
};
const DEFAULT_DESCRIPTION: Record<Locale, string> = {
  ko: "히어스나우는 클릭 시점의 GPS만 저장하는 멀티 테넌트 출퇴근 증빙 SaaS입니다. 본인 얼굴 인식, 출장·야간 근무, 회사별 시간대·근무일 설정과 관리자 통계를 제공합니다.",
  en: "HeresNow is a multi-tenant attendance proof SaaS that stores GPS only when check-in/out is tapped, with face verification, business-trip/night-shift support, company timezone work rules, and admin analytics.",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const siteName = SITE_NAME[locale];
  const title = DEFAULT_TITLE[locale];
  const description = DEFAULT_DESCRIPTION[locale];

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    applicationName: siteName,
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
      title: siteName,
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
      siteName,
      title,
      description,
      url: SITE_URL,
      locale: locale === "en" ? "en_US" : "ko_KR",
      alternateLocale: [locale === "en" ? "ko_KR" : "en_US"],
      images: [
        {
          url: "/favicon.png",
          width: 512,
          height: 512,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
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
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  /** 휴대폰·태블릿에서 화면 회전·노치 대응, 핀치 줌 허용 */
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const siteName = SITE_NAME[locale];
  const description = DEFAULT_DESCRIPTION[locale];
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    founder: { "@type": "Organization", name: "MS Ventures" },
  };

  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: "0",
      highPrice: "3000",
    },
  };

  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] antialiased">
        <Providers initialLocale={locale}>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
        />
      </body>
    </html>
  );
}
