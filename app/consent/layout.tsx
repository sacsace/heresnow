import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Consent" : "이용 동의",
    description:
      locale === "en" ? "HeresNow service consent screen." : "히어스나우 서비스 이용 동의 화면.",
    alternates: { canonical: "/consent" },
    robots: { index: false, follow: false },
  };
}

export default function ConsentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
