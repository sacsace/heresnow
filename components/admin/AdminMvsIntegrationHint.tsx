"use client";

import { useI18n } from "@/components/LanguageProvider";
import { statusBadge } from "@/lib/statusBadge";
import { btnPrimary, groupedCard, hint, sectionLabel } from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

type MvsStatus = {
  companyId: string;
  enabled: boolean;
  externalCompanyId: string | null;
  pendingOutboxCount: number;
  failedOutboxCount: number;
  configured: boolean;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  apiKeyUpdatedAt: string | null;
};

type MvsPreviewResponse = {
  month: string;
  timezone: string;
  count: number;
  employeeAttendance: Array<{
    employee: {
      id: string;
      name: string;
      email: string;
      externalEmployeeId: string | null;
    };
    rows: Array<{
      date: string;
      checkOutDate: string | null;
      incomplete: boolean;
      pending: boolean;
      status: string;
      checkIn: { localTime: string; timestamp: string } | null;
      checkOut: { localTime: string; timestamp: string } | null;
    }>;
  }>;
};

function currentMonthYyyyMm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function AdminMvsIntegrationHint() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<MvsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedCompanyId, setCopiedCompanyId] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMonth, setPreviewMonth] = useState(currentMonthYyyyMm);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MvsPreviewResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/integrations/mvs", { cache: "no-store" });
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

  async function generateApiKey() {
    setGenerating(true);
    setActionError(null);
    setNewApiKey(null);
    try {
      const r = await fetch("/api/admin/integrations/mvs/key", {
        method: "POST",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || typeof j.apiKey !== "string") {
        setActionError(t("admin.mvsApiKeyGenerateFail"));
        return;
      }
      setNewApiKey(j.apiKey);
      await load();
    } catch {
      setActionError(t("admin.mvsApiKeyGenerateFail"));
    } finally {
      setGenerating(false);
    }
  }

  async function copyApiKey() {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 1200);
    } catch {
      /* noop */
    }
  }

  async function copyCompanyId() {
    if (!status?.companyId) return;
    try {
      await navigator.clipboard.writeText(status.companyId);
      setCopiedCompanyId(true);
      setTimeout(() => setCopiedCompanyId(false), 1200);
    } catch {
      /* noop */
    }
  }

  async function loadPreview(month: string) {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const q = new URLSearchParams({ month });
      const r = await fetch(`/api/admin/integrations/mvs/preview?${q.toString()}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPreviewData(null);
        setPreviewError(t("admin.mvsPreviewLoadFail"));
        return;
      }
      setPreviewData(j as MvsPreviewResponse);
    } catch {
      setPreviewData(null);
      setPreviewError(t("admin.mvsPreviewLoadFail"));
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreviewModal() {
    setPreviewOpen(true);
    void loadPreview(previewMonth);
  }

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
              <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                <p className={hint}>
                  {t("admin.mvsCompanyId")}: {status.companyId}
                </p>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg border border-[var(--separator)] px-3 text-[0.75rem] font-medium transition active:scale-95 active:bg-[var(--fill-secondary)]"
                  onClick={() => void copyCompanyId()}
                >
                  {copiedCompanyId ? t("admin.mvsCopied") : t("admin.mvsCompanyIdCopy")}
                </button>
              </div>
              <p className={`text-[0.8125rem] ${hint}`}>
                {status.hasApiKey
                  ? t("admin.mvsApiKeySet").replace("{last4}", status.apiKeyLast4 ?? "----")
                  : t("admin.mvsApiKeyMissing")}
                {status.apiKeyUpdatedAt
                  ? ` · ${new Date(status.apiKeyUpdatedAt).toLocaleString(
                      locale === "en" ? "en-US" : "ko-KR"
                    )}`
                  : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={generating}
                  onClick={() => void generateApiKey()}
                >
                  {generating
                    ? t("common.processing")
                    : status.hasApiKey
                      ? t("admin.mvsApiKeyRegenerate")
                      : t("admin.mvsApiKeyGenerate")}
                </button>
                {newApiKey ? (
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-xl border border-[var(--separator)] px-4 text-[0.875rem] font-medium transition active:scale-95 active:bg-[var(--fill-secondary)]"
                    onClick={() => void copyApiKey()}
                  >
                    {copiedApiKey ? t("admin.mvsCopied") : t("admin.mvsApiKeyCopy")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-xl border border-[var(--separator)] px-4 text-[0.875rem] font-medium transition active:scale-95 active:bg-[var(--fill-secondary)]"
                  onClick={openPreviewModal}
                >
                  {t("admin.mvsPreviewOpen")}
                </button>
              </div>
              {newApiKey ? (
                <div className="rounded-lg bg-[var(--fill-secondary)] p-3">
                  <p className="text-[0.75rem] text-[var(--apple-label-secondary)]">
                    {t("admin.mvsApiKeyGeneratedHint")}
                  </p>
                  <p className="mt-1 break-all font-mono text-[0.875rem] text-[var(--foreground)]">
                    {newApiKey}
                  </p>
                </div>
              ) : null}
              {actionError ? <p className="text-[0.8125rem] text-[var(--apple-red)]">{actionError}</p> : null}
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

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-[var(--grouped-bg)] shadow-xl ring-1 ring-black/[0.08]">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--separator)] px-5 py-4 sm:px-6">
              <div>
                <p className="text-[1rem] font-semibold text-[var(--foreground)]">
                  {t("admin.mvsPreviewTitle")}
                </p>
                {previewData ? (
                  <p className="mt-1 text-[0.8125rem] text-[var(--apple-label-secondary)]">
                    {t("admin.mvsPreviewSummary")
                      .replace("{month}", previewData.month)
                      .replace("{count}", String(previewData.count))
                      .replace("{tz}", previewData.timezone)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[0.75rem] text-[var(--apple-label-secondary)]">
                  <span>{t("admin.mvsPreviewMonth")}</span>
                  <input
                    type="month"
                    className="rounded-lg border border-[var(--separator)] bg-[var(--fill-secondary)] px-3 py-2 text-[0.875rem] text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--apple-blue)]/25"
                    value={previewMonth}
                    onChange={(e) => setPreviewMonth(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-xl border border-[var(--separator)] px-4 text-[0.875rem] font-medium transition active:scale-95 active:bg-[var(--fill-secondary)]"
                  onClick={() => void loadPreview(previewMonth)}
                  disabled={previewLoading}
                >
                  {previewLoading ? t("common.loading") : t("admin.mvsPreviewReload")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-xl border border-[var(--separator)] px-4 text-[0.875rem] font-medium transition active:scale-95 active:bg-[var(--fill-secondary)]"
                  onClick={() => setPreviewOpen(false)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-4 sm:px-6">
              {previewLoading ? (
                <p className={hint}>{t("common.loading")}</p>
              ) : previewError ? (
                <p className="text-[0.875rem] text-[var(--apple-red)]">{previewError}</p>
              ) : !previewData || previewData.employeeAttendance.length === 0 ? (
                <p className={hint}>{t("admin.mvsPreviewEmpty")}</p>
              ) : (
                <div className="space-y-4">
                  {previewData.employeeAttendance.map((item) => (
                    <section key={item.employee.id} className="rounded-xl bg-[var(--fill-secondary)] p-3">
                      <p className="text-[0.875rem] font-semibold text-[var(--foreground)]">
                        {item.employee.name}
                        <span className="ml-2 text-[0.75rem] font-normal text-[var(--apple-label-secondary)]">
                          {item.employee.email}
                          {item.employee.externalEmployeeId
                            ? ` · external: ${item.employee.externalEmployeeId}`
                            : ""}
                        </span>
                      </p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-[0.8125rem]">
                          <thead className="text-[var(--apple-label-secondary)]">
                            <tr>
                              <th className="py-1 pr-4 font-medium">{t("admin.attendanceColDate")}</th>
                              <th className="py-1 pr-4 font-medium">{t("admin.mvsPreviewCheckIn")}</th>
                              <th className="py-1 pr-4 font-medium">{t("admin.mvsPreviewCheckOut")}</th>
                              <th className="py-1 pr-4 font-medium">{t("admin.attendanceColStatus")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.rows.map((row, idx) => (
                              <tr key={`${item.employee.id}:${row.date}:${idx}`} className="border-t border-[var(--separator)]/70">
                                <td className="py-1.5 pr-4 text-[var(--foreground)]">{row.date}</td>
                                <td className="py-1.5 pr-4 text-[var(--foreground)]">
                                  {row.checkIn?.localTime ?? "-"}
                                </td>
                                <td className="py-1.5 pr-4 text-[var(--foreground)]">
                                  {row.checkOut?.localTime ?? "-"}
                                </td>
                                <td className="py-1.5 pr-4 text-[var(--apple-label-secondary)]">
                                  {row.status}
                                  {row.incomplete ? ` · ${t("admin.attendanceIncomplete")}` : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
