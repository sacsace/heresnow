"use client";

import { AppHeaderActions } from "@/components/AppHeaderActions";
import { AppLogo } from "@/components/AppLogo";
import { useI18n } from "@/components/LanguageProvider";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type Props = {
  children: React.ReactNode;
  bodyClassName?: string;
};

export function AdminChrome({ children, bodyClassName = "" }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();

  const menuGroups = useMemo(
    () => [
      {
        id: "core",
        label: "Core",
        items: [
          { href: "/admin", label: t("admin.navDashboard"), exact: true },
          { href: "/admin/punch", label: t("admin.navMyPunch") },
          { href: "/admin/attendance", label: t("admin.navAttendance") },
        ],
      },
      {
        id: "people",
        label: "People",
        items: [
          { href: "/admin/employees", label: t("admin.navEmployees") },
          { href: "/admin/exceptions", label: t("admin.navExceptions") },
        ],
      },
      {
        id: "ops",
        label: "Operations",
        items: [
          { href: "/admin/billing", label: t("admin.navBilling") },
          { href: "/admin/settings", label: t("admin.navSettings") },
          { href: "/admin/account", label: t("common.myAccount") },
        ],
      },
    ],
    [t]
  );

  const links = useMemo(() => menuGroups.flatMap((g) => g.items), [menuGroups]);

  function isActive(href: string, exact?: boolean): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const activeItem =
    links.find((l) => isActive(l.href, "exact" in l ? l.exact : false)) ?? null;
  const activeGroup = menuGroups.find((group) =>
    group.items.some((item) => activeItem?.href === item.href)
  );
  const activeLabel = activeItem?.label ?? t("admin.navDashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="z-40 shrink-0 border-b border-[var(--separator)] bg-[var(--bar-bg)] pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1366px] min-w-0 items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <MobileNavDrawer items={links} />
            <AppLogo href="/admin" title="HeresNow" className="min-w-0" />
            <nav
              className="hidden min-w-0 flex-1 rounded-lg border border-[var(--separator)] bg-white px-2 py-1.5 lg:flex"
              aria-label={t("admin.navDashboard")}
            >
              <div className="grid w-full min-w-0 grid-cols-8 items-center gap-1">
                {links.map((link) => {
                  const active = isActive(link.href, "exact" in link ? link.exact : false);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative inline-flex h-9 min-w-0 items-center justify-center rounded-[0.55rem] px-2 text-[0.75rem] font-semibold transition-colors xl:px-3 xl:text-[0.8125rem] ${
                        active
                          ? "bg-[var(--fill-tertiary)] text-[var(--foreground)]"
                          : "text-[var(--apple-label-secondary)] hover:bg-[var(--fill-secondary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <span className="truncate">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
          <AppHeaderActions />
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-[1366px] min-w-0 px-3 pb-3 pt-4 sm:px-4 lg:px-5">
          <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-[var(--separator)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--separator)] bg-[var(--fill-tertiary)]/40 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--apple-label-tertiary)]">
                  {activeGroup?.label ?? "Core"}
                </p>
                <p className="truncate text-[0.875rem] font-semibold text-[var(--foreground)]">{activeLabel}</p>
                <p className="mt-0.5 truncate text-[0.75rem] text-[var(--apple-label-secondary)]">
                  {t("admin.homeLead")}
                </p>
              </div>
            </div>
            <main className="flex-1">
              <div className={`w-full min-w-0 ${bodyClassName}`.trim()}>{children}</div>
            </main>
            <div className="border-t border-[var(--separator)] bg-white px-3 py-3 sm:px-5">
              <div className="flex w-full flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <LegalFooterLinks
                  layout="inline"
                  className="w-full justify-start text-[0.6875rem] sm:w-auto sm:justify-center lg:justify-start"
                />
                <p className="text-[0.6875rem] text-[var(--apple-label-tertiary)]">© 2026 Minsub Ventures</p>
              </div>
            </div>
          </section>
        </div>
      </div>

    </div>
  );
}
