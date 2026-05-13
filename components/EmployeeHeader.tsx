"use client";

import { HeaderSessionUser } from "@/components/HeaderSessionUser";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";

export function EmployeeHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-3 py-3 sm:px-4 md:max-w-3xl lg:max-w-5xl lg:px-8">
        <Link
          href="/employee"
          className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-zinc-800"
        >
          {t("employee.brand")}
        </Link>
        <div className="flex min-w-0 flex-shrink-0 items-center gap-2">
          <HeaderSessionUser className="mr-1" />
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
