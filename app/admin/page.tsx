"use client";

import { AdminTodayOverview } from "@/components/admin/AdminTodayOverview";
import { AdminSubscriptionBanner } from "@/components/admin/AdminSubscriptionBanner";
import { AdminMvsIntegrationHint } from "@/components/admin/AdminMvsIntegrationHint";
import { MonthlyAttendanceOverview } from "@/components/admin/MonthlyAttendanceOverview";
import { useI18n } from "@/components/LanguageProvider";
import { pageStack, pageSubtitle, pageTitle } from "@/lib/uiStyles";

export default function AdminHomePage() {
  const { t } = useI18n();
  return (
    <div className={pageStack}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={pageTitle}>{t("admin.homeTitle")}</h1>
          <p className={pageSubtitle}>{t("admin.homeLead")}</p>
        </div>
        <AdminSubscriptionBanner />
      </header>

      <AdminTodayOverview />

      <MonthlyAttendanceOverview />

      <AdminMvsIntegrationHint />
    </div>
  );
}
