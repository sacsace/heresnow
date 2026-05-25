"use client";

import { PunchCard } from "@/components/employee/PunchCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/components/LanguageProvider";
import { usePunchStatus } from "@/hooks/usePunchStatus";
import { emptyStateCompact, groupedCard, pageStack } from "@/lib/uiStyles";
import { useSession } from "next-auth/react";

type Props = {
  /** 페이지 헤더·여백 포함 (메뉴 전용 페이지) */
  asPage?: boolean;
};

export function AdminPunchSection({ asPage = false }: Props) {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const { status: punchStatus } = usePunchStatus();

  const pageTitle = punchStatus?.isCheckedIn
    ? t("admin.navCheckOut")
    : punchStatus?.canCheckIn
      ? t("admin.navCheckIn")
      : t("admin.punchSection");

  const body =
    status === "loading" ? (
      <div className={groupedCard}>
        <p className={emptyStateCompact}>{t("common.loading")}</p>
      </div>
    ) : session?.user?.employeeId ? (
      <PunchCard variant="embedded" showRecentRecords={asPage} />
    ) : (
      <div className={groupedCard}>
        <p className={emptyStateCompact}>{t("admin.punchNoProfile")}</p>
      </div>
    );

  if (asPage) {
    return (
      <div className={pageStack}>
        <PageHeader title={pageTitle} subtitle={t("admin.punchLead")} />
        {body}
      </div>
    );
  }

  return body;
}
