"use client";

import { LanguageProvider } from "@/components/LanguageProvider";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
