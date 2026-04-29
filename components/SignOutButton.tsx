"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 ${className}`}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      로그아웃
    </button>
  );
}
