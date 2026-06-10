import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "환불 정책",
  description: "HeresNow 환불 정책.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
