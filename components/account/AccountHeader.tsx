"use client";

import { AppHeaderActions } from "@/components/AppHeaderActions";
import { AppLogo } from "@/components/AppLogo";
import { useI18n } from "@/components/LanguageProvider";
import { navBar, navBarInnerEmployee } from "@/lib/uiStyles";
import { useSession } from "next-auth/react";
import Link from "next/link";

/** 역할별 홈 경로 */
function homeFor(role?: string | null): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super";
    case "COMPANY_ADMIN":
    case "HR_MANAGER":
    case "APPROVER":
      return "/admin";
    case "DOOR":
      return "/door";
    case "EMPLOYEE":
      return "/employee";
    default:
      return "/employee";
  }
}

export function AccountHeader() {
  const { t } = useI18n();
  const { data } = useSession();
  const home = homeFor(data?.user?.role);

  return (
    <header className={`${navBar} pt-[env(safe-area-inset-top,0px)]`}>
      <div className={navBarInnerEmployee}>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
          <AppLogo href={home} title={t("login.title")} />
          <Link
            href={home}
            className="hidden text-[0.8125rem] font-medium text-[var(--apple-blue)] hover:text-[#0071e3] sm:inline-flex"
          >
            ← {t("common.backToHome")}
          </Link>
        </div>
        <AppHeaderActions />
      </div>
    </header>
  );
}
