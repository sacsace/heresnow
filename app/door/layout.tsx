import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "출입문 단말기",
  description: "HeresNow 출입문 단말기 출퇴근",
};

export default function DoorLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[var(--background)]">{children}</div>;
}
