"use client";

import { ChangePasswordCard } from "@/components/account/ChangePasswordCard";
import { useI18n } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { sessionRoleLabel } from "@/lib/sessionDisplay";
import { groupedCard, groupedRow, pageStack, sectionLabel } from "@/lib/uiStyles";

type Props = {
  email: string;
  role: string;
};

export function AccountPageBody({ email, role }: Props) {
  const { t } = useI18n();
  const roleLabel = sessionRoleLabel(email, role, t);

  return (
    <div className={pageStack}>
      <PageHeader title={t("account.title")} subtitle={t("account.subtitle")} />

      <section>
        <p className={sectionLabel}>{t("account.profileLabel")}</p>
        <div className={groupedCard}>
          <div className={groupedRow}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--apple-label-secondary)]">
              {t("account.profileLabel")}
            </p>
            <p className="mt-1 break-all text-[var(--foreground)]">{email}</p>
          </div>
          <div className={`${groupedRow} border-t border-[var(--separator)]`}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--apple-label-secondary)]">
              {t("account.roleLabel")}
            </p>
            <p className="mt-1 text-[var(--foreground)]">{roleLabel}</p>
          </div>
        </div>
      </section>

      <ChangePasswordCard />
    </div>
  );
}
