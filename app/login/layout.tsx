import type { Metadata } from "next";
import { FaceModelPreloader } from "@/components/auth/FaceModelPreloader";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  const title = locale === "en" ? "Sign in" : "로그인";
  const description =
    locale === "en"
      ? "HeresNow admin and employee sign-in page for GPS attendance proof."
      : "히어스나우 관리자·직원 로그인 페이지입니다. 클릭 시점 GPS 출퇴근 증빙 SaaS에 접속하세요.";
  const seoTitle = locale === "en" ? "Sign in | HeresNow" : "로그인 | 히어스나우";

  return {
    title,
    description,
    alternates: { canonical: "/login" },
    openGraph: {
      title: seoTitle,
      description,
      url: "/login",
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

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FaceModelPreloader />
      {children}
    </>
  );
}
