import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Refund Policy" : "환불 정책",
    description: locale === "en" ? "HeresNow refund policy." : "히어스나우 환불 정책.",
    alternates: { canonical: "/refund-policy" },
  };
}

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
