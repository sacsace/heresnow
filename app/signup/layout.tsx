import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  const title = locale === "en" ? "Company sign-up" : "회사 가입";
  const description =
    locale === "en"
      ? "Register your company on HeresNow and start GPS attendance, face check-in, and admin analytics."
      : "히어스나우에 회사를 등록하고 GPS 출퇴근, 얼굴 인식 출근, 관리자 통계를 시작하세요.";
  const seoTitle = locale === "en" ? "Company sign-up | HeresNow" : "회사 가입 | 히어스나우";

  return {
    title,
    description,
    alternates: { canonical: "/signup" },
    keywords: [
      "회사 가입",
      "출퇴근 SaaS 가입",
      "근태 관리 시작",
      "HeresNow 가입",
      "free trial attendance",
    ],
    openGraph: {
      title: seoTitle,
      description,
      url: "/signup",
      type: "website",
      locale: locale === "en" ? "en_US" : "ko_KR",
    },
    twitter: {
      card: "summary",
      title: seoTitle,
      description,
    },
  };
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
