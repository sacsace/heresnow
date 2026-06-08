"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  btnSecondary,
  card,
  cardBody,
  errorText,
  sectionLabel,
  table,
  tableHead,
  tableRow,
  tableWrap,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

export type PaymentRecord = {
  id: string;
  status: string;
  paidAt: string | null;
  employeeCount: number;
  usageMonths: number;
  pricePerUser: number;
  discountTotal: number;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  eInvoiceStatus?: string;
  eInvoiceIrn?: string | null;
  eInvoiceLastError?: string | null;
};

type Props = {
  refreshKey?: number;
  canRetryEInvoice?: boolean;
};

export function PaymentHistorySection({ refreshKey = 0, canRetryEInvoice = false }: Props) {
  const { t, locale } = useI18n();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/billing/payments");
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : t("admin.billingHistoryLoadFail"));
        setPayments([]);
        return;
      }
      setPayments((j.payments ?? []) as PaymentRecord[]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function downloadInvoice(id: string) {
    window.location.assign(`/api/admin/billing/payments/${id}/invoice`);
  }

  async function retryEInvoice(id: string) {
    setRetryingId(id);
    try {
      const r = await fetch(`/api/admin/billing/payments/${id}/e-invoice`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : t("admin.billingEInvoiceRetryFail"));
        return;
      }
      await load();
    } finally {
      setRetryingId(null);
    }
  }

  function eInvoiceLabel(p: PaymentRecord): string {
    switch (p.eInvoiceStatus) {
      case "ISSUED":
        return t("admin.billingEInvoiceIssued");
      case "PENDING":
        return t("admin.billingEInvoicePending");
      case "FAILED":
        return t("admin.billingEInvoiceFailed");
      case "SKIPPED":
        return t("admin.billingEInvoiceSkipped");
      default:
        return "—";
    }
  }

  return (
    <section>
      <h2 className={sectionLabel}>{t("admin.billingHistoryTitle")}</h2>
      <div className={card}>
        <div className={cardBody}>
          {error && <p className={`${errorText} mb-4`}>{error}</p>}
          {loading ? (
            <p className="text-[0.875rem] text-[var(--apple-label-secondary)]">
              {t("common.loading")}
            </p>
          ) : payments.length === 0 ? (
            <p className="text-[0.875rem] text-[var(--apple-label-secondary)]">
              {t("admin.billingNoHistory")}
            </p>
          ) : (
            <div className={tableWrap}>
              <table className={`${table} [&_th]:text-center [&_td]:text-center`}>
                <thead>
                  <tr className={tableHead}>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingHistoryPaidAt")}</th>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingHistoryInvoice")}</th>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingHistorySeats")}</th>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingHistoryTerm")}</th>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingHistoryAmount")}</th>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingEInvoiceCol")}</th>
                    <th className="px-3 py-3 font-semibold">{t("admin.billingHistoryActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className={tableRow}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString(dateLocale, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.8125rem] text-[var(--apple-label-secondary)]">
                        {p.invoiceNumber ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {p.employeeCount}
                        {locale === "en" ? "" : "명"}
                      </td>
                      <td className="px-3 py-3">
                        {p.usageMonths}
                        {locale === "en" ? " mo" : "개월"}
                      </td>
                      <td className="px-3 py-3 font-semibold whitespace-nowrap">
                        {p.currency === "INR" ? "Rs." : p.currency}
                        {p.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-[0.8125rem]">
                        <span
                          className={
                            p.eInvoiceStatus === "ISSUED"
                              ? "font-medium text-[var(--apple-green-dark)]"
                              : p.eInvoiceStatus === "FAILED"
                                ? "text-[var(--apple-red)]"
                                : "text-[var(--apple-label-secondary)]"
                          }
                        >
                          {eInvoiceLabel(p)}
                        </span>
                        {p.eInvoiceStatus === "ISSUED" && p.eInvoiceIrn && (
                          <span className="mt-0.5 block font-mono text-[0.6875rem] text-[var(--apple-label-tertiary)]">
                            {p.eInvoiceIrn.slice(0, 16)}…
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => downloadInvoice(p.id)}
                          >
                            {t("admin.billingDownloadInvoice")}
                          </button>
                          {canRetryEInvoice && p.eInvoiceStatus === "FAILED" && (
                              <button
                                type="button"
                                className={btnSecondary}
                                disabled={retryingId === p.id}
                                onClick={() => void retryEInvoice(p.id)}
                              >
                                {retryingId === p.id
                                  ? t("common.processing")
                                  : t("admin.billingEInvoiceRetry")}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
