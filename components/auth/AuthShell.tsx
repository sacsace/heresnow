"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  authColumnFixed,
  authLangSlot,
  authPage,
  authViewportFooter,
} from "@/components/auth/authStyles";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** 화면 맨 아래 중앙 (저작권 등) */
  footer?: ReactNode;
  /** 동의 화면 등 더 넓은 고정 폭: e.g. !w-[34rem] */
  className?: string;
};

export function AuthShell({ children, footer, className = "" }: Props) {
  return (
    <main className={`${authPage}${footer ? " pb-14 sm:pb-16" : ""}`}>
      <div className={authLangSlot}>
        <LanguageSwitcher variant="auth" />
      </div>
      <div className={`${authColumnFixed} ${className}`.trim()}>
        <div className="flex w-full shrink-0 flex-col justify-center py-2">{children}</div>
      </div>
      {footer ? <div className={authViewportFooter}>{footer}</div> : null}
    </main>
  );
}
