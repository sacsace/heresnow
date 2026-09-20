"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { MonthlyDayCell, MonthlyEmployeeRow } from "@/lib/adminMonthlyAttendance";
import { formatCheckOutDisplay } from "@/lib/autoCheckOut";
import { btnSecondary, emptyStateCompact, hint } from "@/lib/uiStyles";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  employee: MonthlyEmployeeRow | null;
  monthLabel: string;
  dateLocale?: string;
};

function dayStatus(d: MonthlyDayCell): "complete" | "partial" | "pending" | "empty" {
  if (!d.checkIn && !d.checkOut) return "empty";
  if (d.pending) return "pending";
  if (d.checkIn && d.checkOut && !d.incomplete) return "complete";
  return "partial";
}

function formatDayDate(date: string, locale: string): string {
  const [y, m, day] = date.split("-").map(Number);
  if (!y || !m || !day) return date;
  return new Date(y, m - 1, day).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function MonthlyEmployeeDetailModal({
  open,
  onClose,
  employee,
  monthLabel,
  dateLocale,
}: Props) {
  const { t, locale } = useI18n();
  const dl = dateLocale ?? (locale === "en" ? "en-US" : "ko-KR");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const summary = useMemo(() => {
    if (!employee) return { complete: 0, partial: 0, pending: 0, empty: 0, recorded: 0 };
    let complete = 0;
    let partial = 0;
    let pending = 0;
    let empty = 0;
    for (const d of employee.days) {
      const st = dayStatus(d);
      if (st === "complete") complete += 1;
      else if (st === "partial") partial += 1;
      else if (st === "pending") pending += 1;
      else empty += 1;
    }
    return { complete, partial, pending, empty, recorded: complete + partial + pending };
  }, [employee]);

  const recordedDays = useMemo(() => {
    if (!employee) return [];
    return employee.days.filter((d) => d.checkIn || d.checkOut);
  }, [employee]);

  if (!open || !mounted || !employee) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={employee.name}
    >
      <button
        type="button"
        aria-label={t("admin.monthlyEmployeeDetailClose")}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/40 backdrop-blur-sm"
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--background)] shadow-2xl ring-1 ring-black/[0.05] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--separator)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-[1rem] font-semibold text-[var(--foreground)]">
              {employee.name}
            </h2>
            <p className={`mt-1 ${hint}`}>
              {t("admin.monthlyEmployeeDetailLead")
                .replace("{month}", monthLabel)
                .replace("{count}", String(summary.recorded))}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("admin.monthlyEmployeeDetailClose")}
            onClick={onClose}
            className="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] text-[var(--apple-label-secondary)] transition-colors hover:bg-[var(--fill-secondary)] hover:text-[var(--foreground)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[var(--separator)] bg-[var(--fill-tertiary)]/40 px-5 py-2.5 text-[0.8125rem] sm:px-6">
          <span className="text-[var(--apple-green-dark)]">
            {t("admin.monthlyComplete")}: {summary.complete}
          </span>
          <span className="text-amber-700">
            {t("admin.monthlyPartial")}: {summary.partial}
          </span>
          {summary.pending > 0 && (
            <span className="text-amber-800">
              {t("admin.monthlyPending")}: {summary.pending}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 sm:px-6">
          {recordedDays.length === 0 ? (
            <p className={emptyStateCompact}>{t("admin.monthlyEmployeeDetailEmpty")}</p>
          ) : (
            <table className="w-full border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-[var(--separator)] text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--apple-label-tertiary)]">
                  <th className="py-2 pr-3 text-left font-medium normal-case tracking-normal">
                    {t("admin.monthlyEmployeeColDate")}
                  </th>
                  <th className="w-[4.5rem] py-2 text-center font-medium normal-case tracking-normal">
                    {t("admin.monthlyIn")}
                  </th>
                  <th className="w-[4.5rem] py-2 text-center font-medium normal-case tracking-normal">
                    {t("admin.monthlyOut")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recordedDays.map((d) => {
                  const st = dayStatus(d);
                  const rowTint =
                    st === "partial"
                      ? "bg-[var(--apple-orange)]/[0.06]"
                      : st === "pending"
                        ? "bg-[var(--apple-orange)]/[0.08]"
                        : "";
                  return (
                    <tr
                      key={d.date}
                      className={`border-b border-[var(--separator)] last:border-b-0 ${rowTint}`}
                      title={
                        st === "complete"
                          ? t("admin.monthlyLegendComplete")
                          : st === "partial"
                            ? t("admin.monthlyLegendPartial")
                            : st === "pending"
                              ? t("admin.monthlyPending")
                              : undefined
                      }
                    >
                      <td className="py-2.5 pr-3 font-medium text-[var(--foreground)]">
                        {formatDayDate(d.date, dl)}
                      </td>
                      <td
                        className={`py-2.5 text-center tabular-nums font-semibold ${
                          d.checkIn
                            ? "text-[var(--foreground)]"
                            : "text-[var(--apple-orange-dark)]"
                        }`}
                      >
                        {d.checkIn ?? "—"}
                      </td>
                      <td
                        className={`py-2.5 text-center tabular-nums font-semibold ${
                          d.checkOut
                            ? "text-[var(--foreground)]"
                            : "text-[var(--apple-orange-dark)]"
                        }`}
                      >
                        {d.checkOut
                          ? formatCheckOutDisplay(d.checkOut, Boolean(d.checkOutAuto), t)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex justify-end border-t border-[var(--separator)] px-5 py-3 sm:px-6">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t("admin.monthlyEmployeeDetailClose")}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
