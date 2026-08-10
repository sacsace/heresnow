import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: locale === "en" ? "Door terminal" : "출입문 단말기",
    description:
      locale === "en" ? "HeresNow door terminal attendance mode." : "히어스나우 출입문 단말기 출퇴근",
  };
}

export default function DoorLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[var(--background)]">{children}</div>;
}
