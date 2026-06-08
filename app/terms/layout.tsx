import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "HeresNow 서비스 이용약관.",
  alternates: { canonical: "/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
