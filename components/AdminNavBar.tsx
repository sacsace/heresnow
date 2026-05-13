"use client";

import { HeaderSessionUser } from "@/components/HeaderSessionUser";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";

export function AdminNavBar() {
  const { t } = useI18n();
  const links = [
    { href: "/admin", label: t("admin.navDashboard") },
    { href: "/admin/employees", label: t("admin.navEmployees") },
    { href: "/admin/billing", label: t("admin.navBilling") },
    { href: "/admin/attendance", label: t("admin.navAttendance") },
    { href: "/admin/exceptions", label: t("admin.navExceptions") },
  ];

  return (
    <header className="border-b border-zinc-100 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
      <div className="mx-auto flex min-w-0 max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-800">{t("admin.brand")}</span>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/employee"
              className="rounded-md px-2.5 py-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
            >
              {t("admin.navEmployeeView")}
            </Link>
          </nav>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <HeaderSessionUser />
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
