"use client";

import { AppHeaderActions } from "@/components/AppHeaderActions";
import { AppLogo } from "@/components/AppLogo";
import { useI18n } from "@/components/LanguageProvider";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import {
  navBar,
  navBarInner,
  navSegmentedBtn,
  navSegmentedWrap,
} from "@/lib/uiStyles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export function AdminNavBar() {
  const { t } = useI18n();
  const pathname = usePathname();

  const links = useMemo(() => {
    return [
      { href: "/admin", label: t("admin.navDashboard"), exact: true },
      { href: "/admin/punch", label: t("admin.navMyPunch") },
      { href: "/admin/employees", label: t("admin.navEmployees") },
      { href: "/admin/billing", label: t("admin.navBilling") },
      { href: "/admin/attendance", label: t("admin.navAttendance") },
      { href: "/admin/exceptions", label: t("admin.navExceptions") },
      { href: "/employee", label: t("admin.navEmployeeView") },
    ];
  }, [t]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className={`${navBar} pt-[env(safe-area-inset-top,0px)]`}>
      <div className={`${navBarInner} max-w-[86.4rem]`}>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <MobileNavDrawer items={links} />
          <AppLogo href="/admin" title={t("login.title")} />
          <nav
            className={`hidden sm:inline-flex ${navSegmentedWrap}`}
            aria-label={t("admin.navDashboard")}
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={navSegmentedBtn(isActive(l.href, "exact" in l ? l.exact : false))}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <AppHeaderActions />
      </div>
    </header>
  );
}
