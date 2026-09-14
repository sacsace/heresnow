"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  bannerSuccess,
  bannerWarning,
  btnPrimary,
  groupedCard,
  groupedRow,
  hint,
  input,
  label,
  pageStack,
  sectionLabel,
} from "@/lib/uiStyles";
import type { WorkRequestType } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

type WorkRequestRow = {
  id: string;
  workDate: string;
  reason: string;
  extraMinutes: number | null;
  status: string;
  createdAt: string;
};

type Props = {
  type: WorkRequestType;
};

export function WorkRequestPanel({ type }: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const isOvertime = type === "OVERTIME";
  const [workDate, setWorkDate] = useState("");
  const [reason, setReason] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [items, setItems] = useState<WorkRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/employee/work-requests?type=${type}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setItems((j as { requests?: WorkRequestRow[] }).requests ?? []);
    setLoading(false);
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (!workDate.trim() || !reason.trim()) {
      setError(t("employee.workRequestRequired"));
      return;
    }
    if (isOvertime && !extraMinutes.trim()) {
      setError(t("employee.overtimeMinutesRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/employee/work-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          workDate: workDate.trim(),
          reason: reason.trim(),
          ...(isOvertime ? { extraMinutes: Number(extraMinutes) } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : t("employee.workRequestSubmitFail"));
        return;
      }
      setMsg(t("employee.workRequestSubmitOk"));
      setReason("");
      setExtraMinutes("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function statusLabel(status: string) {
    if (status === "PENDING") return t("employee.workRequestStatusPending");
    if (status === "APPROVED") return t("employee.workRequestStatusApproved");
    if (status === "REJECTED") return t("employee.workRequestStatusRejected");
    return status;
  }

  return (
    <div className={pageStack}>
      <p className={hint}>
        {isOvertime ? t("employee.overtimeRequestLead") : t("employee.earlyLeaveRequestLead")}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={label}>{t("employee.workRequestDateLabel")}</label>
          <input
            type="date"
            className={input}
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        {isOvertime && (
          <div>
            <label className={label}>{t("employee.overtimeMinutesLabel")}</label>
            <input
              type="number"
              min={1}
              max={1440}
              className={input}
              value={extraMinutes}
              onChange={(e) => setExtraMinutes(e.target.value)}
              placeholder={t("employee.overtimeMinutesPlaceholder")}
              required
              disabled={submitting}
            />
          </div>
        )}
        <div>
          <label className={label}>{t("employee.workRequestReasonLabel")}</label>
          <textarea
            className={`${input} min-h-[5rem]`}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isOvertime
                ? t("employee.overtimeReasonPlaceholder")
                : t("employee.earlyLeaveReasonPlaceholder")
            }
            maxLength={2000}
            required
            disabled={submitting}
          />
        </div>
        {error && <p className={bannerWarning}>{error}</p>}
        {msg && <p className={bannerSuccess}>{msg}</p>}
        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? t("common.loading") : t("employee.workRequestSubmit")}
        </button>
      </form>

      <section>
        <p className={sectionLabel}>{t("employee.workRequestHistory")}</p>
        {loading ? (
          <p className={hint}>{t("common.loading")}</p>
        ) : items.length === 0 ? (
          <p className={hint}>{t("employee.workRequestEmpty")}</p>
        ) : (
          <ul className={groupedCard}>
            {items.map((item, i) => (
              <li
                key={item.id}
                className={`${groupedRow} ${i < items.length - 1 ? "border-b border-[var(--separator)]" : ""}`}
              >
                <p className="font-semibold text-[var(--foreground)]">
                  {item.workDate}
                  {isOvertime && item.extraMinutes
                    ? ` · ${t("employee.overtimeMinutesShort").replace("{n}", String(item.extraMinutes))}`
                    : ""}
                </p>
                <p className={`mt-1 ${hint}`}>
                  {new Date(item.createdAt).toLocaleString(dateLocale)} · {statusLabel(item.status)}
                </p>
                <p className="mt-2 text-[0.9375rem] text-[var(--foreground)]">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
