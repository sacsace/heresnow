"use client";

import { useI18n } from "@/components/LanguageProvider";
import { card, cardBody, pageSubtitle, pageTitle } from "@/lib/uiStyles";
import Link from "next/link";

export default function SubscriptionExpiredPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className={pageTitle}>{t("employee.subscriptionExpiredTitle")}</h1>
      <p className={pageSubtitle}>{t("employee.subscriptionExpiredLead")}</p>
      <div className={`${card} mt-8`}>
        <div className={`${cardBody} space-y-3 text-[0.9375rem]`}>
          <p>{t("employee.subscriptionExpiredHint")}</p>
          <p className="text-[var(--apple-label-secondary)]">
            {t("employee.subscriptionExpiredAdminNote")}
          </p>
        </div>
      </div>
      <p className="mt-6 text-center">
        <Link href="/login" className="text-[var(--apple-blue)] underline-offset-2 hover:underline">
          {t("common.signOut")}
        </Link>
      </p>
    </div>
  );
}
