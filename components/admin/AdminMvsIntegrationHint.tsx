"use client";

import { useI18n } from "@/components/LanguageProvider";
import { statusBadge } from "@/lib/statusBadge";
import { groupedCard, hint, sectionLabel } from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

type MvsStatus = {
  enabled: boolean;
  externalCompanyId: string | null;
  pendingOutboxCount: number;
  failedOutboxCount: number;
  configured: boolean;
};

export function AdminMvsIntegrationHint() {
  const { t } = useI18n();
  const [status, setStatus] = useState<MvsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/integrations/mvs");
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (r.ok) setStatus(j as MvsStatus);
    else setStatus(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const badgeClass = status?.enabled
    ? statusBadge("APPROVED")
    : status?.configured
      ? statusBadge("PENDING")
      : statusBadge("MIXED");

  return (
    <section>
      <p className={sectionLabel}>{t("admin.mvsTitle")}</p>
      <div className={groupedCard}>
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-[0.9375rem] leading-relaxed text-[var(--apple-label-secondary)]">
            {t("admin.mvsLead")}
          </p>

          {loading ? (
            <p className={`mt-3 text-[0.875rem] ${hint}`}>{t("common.loading")}</p>
          ) : status ? (
            <div className="mt-4 space-y-3">
              <p className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                <span className={badgeClass}>
                  {status.enabled ? t("admin.mvsEnabled") : t("admin.mvsDisabled")}
                </span>
                {status.externalCompanyId && (
                  <span className={hint}>
                    {t("admin.mvsExternalId")}: {status.externalCompanyId}
                  </span>
                )}
              </p>
              {(status.pendingOutboxCount > 0 || status.failedOutboxCount > 0) && (
                <p className={`text-[0.8125rem] ${hint}`}>
                  {t("admin.mvsOutbox")
                    .replace("{pending}", String(status.pendingOutboxCount))
                    .replace("{failed}", String(status.failedOutboxCount))}
                </p>
              )}
            </div>
          ) : null}

          <details className="mt-4 group">
            <summary className="cursor-pointer select-none text-[0.875rem] font-semibold text-[var(--apple-blue)] hover:text-[#0071e3]">
              {t("admin.mvsHowToToggle")}
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[0.875rem] leading-relaxed text-[var(--apple-label-secondary)]">
              <li>{t("admin.mvsStep1")}</li>
              <li>{t("admin.mvsStep2")}</li>
              <li>{t("admin.mvsStep3")}</li>
              <li>{t("admin.mvsStep4")}</li>
              <li>{t("admin.mvsStep5")}</li>
            </ol>
            <p className={`mt-3 text-[0.8125rem] ${hint}`}>{t("admin.mvsNote")}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
