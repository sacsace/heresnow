"use client";

import { AppHeaderActions } from "@/components/AppHeaderActions";
import { AppLogo } from "@/components/AppLogo";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { useI18n } from "@/components/LanguageProvider";
import { navBar, navBarInnerEmployee } from "@/lib/uiStyles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export function EmployeeHeader() {
  const { t } = useI18n();
  const pathname = usePathname();

  const navItems = useMemo(
    () => [
      { href: "/employee", label: t("employee.navPunch"), exact: true },
      { href: "/employee/approvals", label: t("approvals.navTitle") },
    ],
    [t]
  );

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className={`${navBar} pt-[env(safe-area-inset-top,0px)]`}>
      <div className={navBarInnerEmployee}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <MobileNavDrawer items={navItems} />
          <AppLogo href="/employee" title={t("login.title")} className="min-w-0" />
          <nav
            className="hidden min-w-0 flex-1 overflow-x-auto lg:flex lg:gap-1"
            aria-label={t("common.menu")}
          >
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-[0.55rem] px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                    active
                      ? "bg-[var(--fill-tertiary)] text-[var(--foreground)]"
                      : "text-[var(--apple-label-secondary)] hover:bg-[var(--fill-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <AppHeaderActions />
      </div>
    </header>
  );
}
