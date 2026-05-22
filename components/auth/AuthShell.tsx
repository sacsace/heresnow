"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { authLangSlot, authPage } from "@/components/auth/authStyles";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** 로그인처럼 카드 밖 하단 푸터(저작권 등) */
  footer?: ReactNode;
  className?: string;
};

export function AuthShell({ children, footer, className = "" }: Props) {
  return (
    <main className={`${authPage} ${className}`}>
      <div className={authLangSlot}>
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
      {footer}
    </main>
  );
}
