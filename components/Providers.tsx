"use client";

import { LanguageProvider } from "@/components/LanguageProvider";
import { MobileAppInstallPrompt } from "@/components/MobileAppInstallPrompt";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        {children}
        <MobileAppInstallPrompt />
      </LanguageProvider>
    </SessionProvider>
  );
}
