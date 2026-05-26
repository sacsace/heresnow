"use client";

import { useI18n } from "@/components/LanguageProvider";
import { useSession } from "next-auth/react";
import Link from "next/link";

/**
 * 모바일 전용(sm:hidden) "내 계정" 아이콘 버튼.
 * 데스크톱에서는 HeaderSessionUser 의 이메일 링크가 같은 경로로 안내한다.
 */
export function HeaderAccountIconLink() {
  const { t } = useI18n();
  const { status } = useSession();

  if (status !== "authenticated") return null;

  return (
    <Link
      href="/account"
      aria-label={t("common.myAccount")}
      title={t("common.myAccount")}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-[var(--fill-secondary)] text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary-hover)] sm:hidden"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </Link>
  );
}
