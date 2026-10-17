"use client";

import { AppHeaderActions } from "@/components/AppHeaderActions";
import { AppLogo } from "@/components/AppLogo";
import { useI18n } from "@/components/LanguageProvider";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { navBar, navBarInnerSuper, navLink, navLinkActive, navLinkEqual, navLinkSuperMin, navLinksRow } from "@/lib/uiStyles";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export function SuperNavBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isRoot =
    session?.user?.role === "SUPER_ADMIN" &&
    (session.user.email ?? "").trim().toLowerCase() === "root";

  const nav = useMemo(
    () => [
      { href: "/super", label: t("super.navCompanies"), exact: true },
      { href: "/super/pricing", label: t("super.navPricing") },
      ...(isRoot
        ? [{ href: "/super/menu-settings", label: t("super.navMenuSettings") }]
        : []),
    ],
    [isRoot, t]
  );

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className={`${navBar} pt-[env(safe-area-inset-top,0px)]`}>
      <div className={navBarInnerSuper}>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-6">
          <MobileNavDrawer items={nav} />
          <AppLogo href="/super" title={t("login.title")} className="min-w-0" />
          <nav className={`hidden sm:flex ${navLinksRow}`}>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`${isActive(n.href, n.exact) ? navLinkActive : navLink} ${navLinkEqual} ${navLinkSuperMin}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <AppHeaderActions />
      </div>
    </header>
  );
}
