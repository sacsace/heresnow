import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Cancellation Policy" : "취소 정책",
    description: locale === "en" ? "HeresNow cancellation policy." : "히어스나우 취소 정책.",
    alternates: { canonical: "/cancellation-policy" },
  };
}

export default function CancellationPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
