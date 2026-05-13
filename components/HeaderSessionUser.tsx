"use client";

import { useI18n } from "@/components/LanguageProvider";
import { sessionRoleLabel } from "@/lib/sessionDisplay";
import { useSession } from "next-auth/react";

type Props = { className?: string };

export function HeaderSessionUser({ className = "" }: Props) {
  const { data, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return <div className={`text-xs text-zinc-400 ${className}`}>…</div>;
  }
  if (status !== "authenticated" || !data?.user?.email) {
    return null;
  }

  const { email, role } = data.user;
  const roleLabel = sessionRoleLabel(email, role, t);

  return (
    <div
      className={`min-w-0 max-w-[min(100%,22rem)] ${className}`}
      title={`${email} · ${roleLabel}`}
    >
      <p className="truncate text-right text-xs leading-snug text-zinc-800">
        <span className="font-mono">{email}</span>
        <span className="text-zinc-400"> · </span>
        <span className="text-zinc-600">{roleLabel}</span>
      </p>
    </div>
  );
}
