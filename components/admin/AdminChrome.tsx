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
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-[var(--foreground)]">
      <header className="z-40 shrink-0 border-b border-[var(--separator)] bg-[var(--bar-bg)]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex w-full min-w-0 items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8 2xl:px-10">
          <div className="flex min-w-0 items-center gap-2.5">
            <MobileNavDrawer items={links} />
            <AppLogo href="/admin" title="HeresNow" className="min-w-0" />
          </div>
          <AppHeaderActions />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full min-w-0 gap-3 px-3 pb-3 pt-4 sm:px-4 lg:gap-4 lg:px-5 2xl:px-6">
          <aside className="hidden h-full w-64 shrink-0 rounded-2xl border border-[var(--separator)] bg-[#f5f9ff] shadow-sm lg:flex lg:flex-col">
            <div className="border-b border-[var(--separator)] px-4 py-3.5">
              <p className="truncate text-[0.875rem] font-semibold tracking-tight text-[var(--foreground)]">
                {t("login.title")}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">Admin Workspace</p>
            </div>
            <nav className="flex-1 space-y-3 overflow-y-auto p-2.5" aria-label={t("admin.navDashboard")}>
              {menuGroups.map((group) => (
                <section key={group.id}>
                  <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--apple-label-tertiary)]">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((link) => {
                      const active = isActive(link.href, "exact" in link ? link.exact : false);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`group flex min-h-[2.375rem] items-center gap-2.5 rounded-xl px-3 text-[0.8125rem] font-medium transition-colors ${
                            active
                              ? "bg-[#eaf3ff] text-[var(--foreground)] shadow-sm ring-1 ring-[#bdd7fa]/80"
                              : "text-[var(--apple-label-secondary)] hover:bg-[var(--fill-secondary)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                              active ? "bg-[var(--apple-blue)]" : "bg-[var(--apple-label-tertiary)]/80"
                            }`}
                          />
                          <span className="truncate">{link.label}</span>
                          <span className="ml-auto text-[0.6875rem] text-[var(--apple-label-tertiary)]">›</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>
            <div className="space-y-2 border-t border-[var(--separator)] px-4 py-3">
              <LegalFooterLinks layout="stack" className="text-[0.6875rem]" />
              <p className="text-[0.6875rem] text-[var(--apple-label-tertiary)]">© 2026 Minsub Ventures</p>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-[var(--separator)] bg-[#f8fbff] shadow-[0_8px_24px_rgba(102,132,176,0.12)]">
            <div className="flex items-center justify-between border-b border-[var(--separator)] px-4 py-3 sm:px-5">
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
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className={`w-full min-w-0 ${bodyClassName}`.trim()}>{children}</div>
            </main>
          </section>
        </div>
      </div>

    </div>
  );
}
