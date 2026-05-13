"use client";

import { useI18n } from "@/components/LanguageProvider";
import { signOut } from "next-auth/react";

export function SignOutButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 ${className}`}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {t("common.signOut")}
    </button>
  );
}
