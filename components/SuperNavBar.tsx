"use client";

import { HeaderSessionUser } from "@/components/HeaderSessionUser";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";

export function SuperNavBar() {
  const { t } = useI18n();
  const nav = [
    { href: "/super", label: t("super.navCompanies") },
    { href: "/super/pricing", label: t("super.navPricing") },
    { href: "/super/billing", label: t("super.navBilling") },
  ];

  return (
    <header className="border-b border-zinc-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <HeaderSessionUser />
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
