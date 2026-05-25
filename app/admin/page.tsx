"use client";

import { AdminCompanySettings } from "@/components/admin/AdminCompanySettings";
import { AdminCompanySiteRegistration } from "@/components/admin/AdminCompanySiteRegistration";
import { AdminMvsIntegrationHint } from "@/components/admin/AdminMvsIntegrationHint";
import { AdminTodayOverview } from "@/components/admin/AdminTodayOverview";
import { MonthlyAttendanceOverview } from "@/components/admin/MonthlyAttendanceOverview";
import { AttendanceTrustHero } from "@/components/ui/AttendanceTrustHero";
import { useI18n } from "@/components/LanguageProvider";
import { pageStack, pageSubtitle, pageTitle } from "@/lib/uiStyles";

export default function AdminHomePage() {
  const { t } = useI18n();
  return (
    <div className={pageStack}>
      <header>
        <h1 className={pageTitle}>{t("admin.homeTitle")}</h1>
        <p className={pageSubtitle}>{t("admin.homeLead")}</p>
      </header>

      <AttendanceTrustHero variant="admin" />

      <AdminTodayOverview />

      <MonthlyAttendanceOverview />

      <AdminCompanySiteRegistration />

      <AdminCompanySettings />

      <AdminMvsIntegrationHint />
    </div>
  );
}
