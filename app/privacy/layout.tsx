import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Privacy Policy" : "개인정보 처리방침",
    description: locale === "en" ? "HeresNow privacy policy." : "히어스나우 개인정보 처리방침.",
    alternates: { canonical: "/privacy" },
  };
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
