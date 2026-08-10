"use client";

import { LanguageProvider } from "@/components/LanguageProvider";
import { MobileAppInstallPrompt } from "@/components/MobileAppInstallPrompt";
import type { Locale } from "@/lib/i18n/dictionaries";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  return (
    <SessionProvider>
      <LanguageProvider initialLocale={initialLocale}>
        {children}
        <MobileAppInstallPrompt />
      </LanguageProvider>
    </SessionProvider>
  );
}
