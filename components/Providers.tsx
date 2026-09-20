"use client";

import { LanguageProvider } from "@/components/LanguageProvider";
import { MobileAppInstallPrompt } from "@/components/MobileAppInstallPrompt";
import { SessionKickWatcher } from "@/components/SessionKickWatcher";
import { PushAutoEnabler } from "@/components/PushAutoEnabler";
import { PushServiceWorkerRegistrar } from "@/components/PushServiceWorkerRegistrar";
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
    <SessionProvider refetchInterval={30 * 60} refetchOnWindowFocus>
      <LanguageProvider initialLocale={initialLocale}>
        <SessionKickWatcher />
        {children}
        <PushServiceWorkerRegistrar />
        <PushAutoEnabler />
        <MobileAppInstallPrompt />
      </LanguageProvider>
    </SessionProvider>
  );
}
