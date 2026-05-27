"use client";

import { AdminCompanySettings } from "@/components/admin/AdminCompanySettings";
import { AdminCompanySiteRegistration } from "@/components/admin/AdminCompanySiteRegistration";
import { AdminMvsIntegrationHint } from "@/components/admin/AdminMvsIntegrationHint";
import { useI18n } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageStack } from "@/lib/uiStyles";

export default function AdminSettingsPage() {
  const { t } = useI18n();

  return (
    <div className={pageStack}>
      <PageHeader
        title={t("admin.settingsPageTitle")}
        subtitle={t("admin.settingsPageLead")}
      />

      <AdminCompanySiteRegistration />

      <AdminCompanySettings />

      <AdminMvsIntegrationHint />
    </div>
  );
}
