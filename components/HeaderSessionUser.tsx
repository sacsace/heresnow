"use client";

import { useI18n } from "@/components/LanguageProvider";
import { sessionRoleLabel } from "@/lib/sessionDisplay";
import { headerUserEmail, headerUserPanel } from "@/lib/uiStyles";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Props = { className?: string };

export function HeaderSessionUser({ className = "" }: Props) {
  const { data, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div className={`hidden sm:flex ${headerUserPanel} ${className}`.trim()}>
        <span className="text-[0.8125rem] text-[var(--apple-label-tertiary)]">…</span>
      </div>
    );
  }
  if (status !== "authenticated" || !data?.user?.email) {
    return null;
  }

  const { email, role } = data.user;
  const roleLabel = sessionRoleLabel(email, role, t);

  return (
    <Link
      href="/account"
      className={`hidden sm:flex ${headerUserPanel} ${className} rounded-md transition-colors hover:bg-[var(--fill-secondary)]`.trim()}
      title={`${email} · ${roleLabel} — ${t("common.myAccount")}`}
      aria-label={t("common.myAccount")}
    >
      <p className={headerUserEmail}>{email}</p>
      <p className="mt-0.5 truncate text-[0.6875rem] leading-tight text-[var(--apple-label-secondary)] sm:text-[0.75rem]">
        {roleLabel}
      </p>
    </Link>
  );
}
