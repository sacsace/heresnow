import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "취소 정책",
  description: "HeresNow 취소 정책.",
  alternates: { canonical: "/cancellation-policy" },
};

export default function CancellationPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
