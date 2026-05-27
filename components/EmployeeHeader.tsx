"use client";

import { AppHeaderActions } from "@/components/AppHeaderActions";
import { AppLogo } from "@/components/AppLogo";
import { useI18n } from "@/components/LanguageProvider";
import { navBar, navBarInnerEmployee } from "@/lib/uiStyles";

export function EmployeeHeader() {
  const { t } = useI18n();
  return (
    <header className={`${navBar} pt-[env(safe-area-inset-top,0px)]`}>
      <div className={navBarInnerEmployee}>
        <div className="min-w-0 flex-1 overflow-hidden">
          <AppLogo href="/employee" title={t("login.title")} />
        </div>
        <AppHeaderActions />
      </div>
    </header>
  );
}
