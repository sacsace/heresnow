"use client";

import { useI18n } from "@/components/LanguageProvider";
import { sessionRoleLabel } from "@/lib/sessionDisplay";
import { headerUserEmail, headerUserPanel } from "@/lib/uiStyles";
import { useSession } from "next-auth/react";

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
    <div
      className={`hidden sm:flex ${headerUserPanel} ${className}`.trim()}
      title={`${email} · ${roleLabel}`}
    >
      <p className={headerUserEmail}>{email}</p>
    </div>
  );
}
