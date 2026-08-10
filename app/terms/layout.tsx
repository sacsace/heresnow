import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Terms and Conditions" : "이용약관",
    description:
      locale === "en" ? "Terms and conditions for using HeresNow service." : "히어스나우 서비스 이용약관.",
    alternates: { canonical: "/terms" },
  };
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
