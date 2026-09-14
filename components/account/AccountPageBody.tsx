"use client";

import { ChangePasswordCard } from "@/components/account/ChangePasswordCard";
import { FaceManagementCard } from "@/components/account/FaceManagementCard";
import { PasskeyManagementCard } from "@/components/account/PasskeyManagementCard";
import { PushNotificationCard } from "@/components/account/PushNotificationCard";
import { useI18n } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { sessionRoleLabel } from "@/lib/sessionDisplay";
import { card, cardBody, cardHeader, label, pageStack } from "@/lib/uiStyles";

type Props = {
  email: string;
  name: string | null;
  role: string;
};

export function AccountPageBody({ email, name, role }: Props) {
  const { t } = useI18n();
  const roleLabel = sessionRoleLabel(email, role, t);

  return (
    <div className={pageStack}>
      <PageHeader title={t("account.title")} subtitle={t("account.subtitle")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="flex flex-col gap-6 lg:h-full lg:min-h-0">
          <section className={`${card} shrink-0`}>
            <div className={cardHeader}>
              <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
                {t("account.profileLabel")}
              </p>
            </div>
            <div className={`${cardBody} space-y-4`}>
              <div className={`grid gap-4 ${name ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                {name ? (
                  <div className="min-w-0">
                    <p className={label}>{t("account.nameLabel")}</p>
                    <p className="mt-1.5 truncate text-[0.9375rem] text-[var(--foreground)]">
                      {name}
                    </p>
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className={label}>{t("account.profileLabel")}</p>
                  <p className="mt-1.5 break-all text-[0.9375rem] text-[var(--foreground)]">
                    {email}
                  </p>
                </div>
              </div>
              <div>
                <p className={label}>{t("account.roleLabel")}</p>
                <p className="mt-1.5 text-[0.9375rem] text-[var(--foreground)]">{roleLabel}</p>
              </div>
            </div>
          </section>

          <PushNotificationCard className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" />
        </div>

        <ChangePasswordCard className="lg:flex lg:h-full lg:min-h-0 lg:flex-col" />
      </div>
      <PasskeyManagementCard />
      <FaceManagementCard />
    </div>
  );
}
