"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { authLangSlot } from "@/components/auth/authStyles";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  footer: ReactNode;
};

/** 이용약관·개인정보 등 긴 문서 — 뷰포트 너비에 맞춰 읽기 폭 확장 */
export function LegalPageShell({ children, footer }: Props) {
  return (
    <main className="auth-surface relative flex min-h-dvh flex-col">
      <div className={authLangSlot}>
        <LanguageSwitcher variant="auth" />
      </div>

      <div className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-10 lg:py-10">
        <div className="w-full min-w-0 max-w-[36rem] md:max-w-[44rem] lg:max-w-[50rem] xl:max-w-[56rem]">
          {children}
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--separator)] bg-[var(--bar-bg)] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-10">
        <div className="mx-auto w-full min-w-0 max-w-[36rem] md:max-w-[44rem] lg:max-w-[50rem] xl:max-w-[56rem]">
          {footer}
        </div>
      </footer>
    </main>
  );
}
