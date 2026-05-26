"use client";

import { HeaderAccountIconLink } from "@/components/HeaderAccountIconLink";
import { HeaderSessionUser } from "@/components/HeaderSessionUser";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { headerActions } from "@/lib/uiStyles";

/** 네비게이션 우측: 사용자 · 언어 · 로그아웃 */
export function AppHeaderActions() {
  return (
    <div className={headerActions}>
      <HeaderSessionUser />
      <HeaderAccountIconLink />
      <LanguageSwitcher />
      <SignOutButton />
    </div>
  );
}
