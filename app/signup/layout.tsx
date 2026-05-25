import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회사 가입",
  description:
    "HeresNow에 회사를 등록하고 GPS 출퇴근, 얼굴 인식 출근, 관리자 통계를 시작하세요. 1명 7일 무료 체험과 1–100명 구간별 요금제를 제공합니다.",
  alternates: { canonical: "/signup" },
  keywords: [
    "회사 가입",
    "출퇴근 SaaS 가입",
    "근태 관리 시작",
    "HeresNow 가입",
    "free trial attendance",
  ],
  openGraph: {
    title: "회사 가입 | HeresNow",
    description: "HeresNow에서 회사를 등록하고 출퇴근 SaaS를 시작하세요.",
    url: "/signup",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "회사 가입 | HeresNow",
    description: "HeresNow에서 회사를 등록하고 출퇴근 SaaS를 시작하세요.",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
