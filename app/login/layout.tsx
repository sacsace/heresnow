import type { Metadata } from "next";
import { FaceModelPreloader } from "@/components/auth/FaceModelPreloader";

export const metadata: Metadata = {
  title: "로그인",
  description:
    "HeresNow 관리자·직원 로그인 페이지입니다. 클릭 시점 GPS 출퇴근 증빙 SaaS에 접속하세요.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "로그인 | HeresNow",
    description: "HeresNow 관리자·직원 로그인 페이지",
    url: "/login",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "로그인 | HeresNow",
    description: "HeresNow 관리자·직원 로그인 페이지",
  },
};

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
