import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용 동의",
  description: "HeresNow 서비스 이용 동의 화면.",
  alternates: { canonical: "/consent" },
  robots: { index: false, follow: false },
};

export default function ConsentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
