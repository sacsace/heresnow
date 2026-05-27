"use client";

import { useI18n } from "@/components/LanguageProvider";
import { btnSecondary } from "@/lib/uiStyles";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut({ redirect: false });
    } catch {
      /* 세션 API 실패 시에도 로그인 화면으로 이동 */
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      className={`${btnSecondary} shrink-0 !px-2.5 !text-[0.75rem] disabled:opacity-50 sm:!px-4 sm:!text-[0.875rem] ${className}`}
      onClick={() => void handleSignOut()}
    >
      {busy ? t("common.processing") : t("common.signOut")}
    </button>
  );
}
