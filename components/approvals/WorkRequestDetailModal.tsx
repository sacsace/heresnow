"use client";

import { useI18n } from "@/components/LanguageProvider";
import { statusBadge } from "@/lib/statusBadge";
import { btnSecondary, btnSuccess, hint } from "@/lib/uiStyles";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type WorkRequestDetail = {
  typeLabel: string;
  sourceLabel?: string;
  employeeName?: string;
  dateLabel: string;
  checkInLabel?: string;
  checkOutLabel?: string;
  detail?: string;
  reason: string;
  status: string;
  submittedLabel: string;
  approverName?: string | null;
  processedLabel?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  detail: WorkRequestDetail | null;
  statusLabel: (status: string) => string;
  showActions?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-[0.8125rem] font-medium text-[var(--apple-label-tertiary)]">{label}</dt>
      <dd className="text-[0.875rem] leading-relaxed text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

export function WorkRequestDetailModal({
  open,
  onClose,
  detail,
  statusLabel,
  showActions,
  onApprove,
  onReject,
}: Props) {
  const { t } = useI18n();
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

  if (!mounted || !open || !detail) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-request-detail-title"
    >
      <button
        type="button"
        aria-label={t("common.cancel")}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/25 backdrop-blur-[6px]"
      />

      <div
        className="relative flex max-h-[min(92dvh,44rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-t-[1rem] bg-[var(--background)] shadow-[0_8px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:max-w-[32rem] sm:rounded-[0.875rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--separator)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="work-request-detail-title"
                className="text-[1.0625rem] font-semibold tracking-tight text-[var(--foreground)]"
              >
                {detail.typeLabel}
              </h2>
              <span className={statusBadge(detail.status)}>{statusLabel(detail.status)}</span>
            </div>
            {detail.sourceLabel ? (
              <p className={`mt-1.5 ${hint}`}>{detail.sourceLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={t("common.cancel")}
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

        <dl className="space-y-4 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {detail.employeeName ? (
            <DetailField label={t("approvals.receivedColEmployee")}>{detail.employeeName}</DetailField>
          ) : null}
          {detail.checkInLabel ? (
            <DetailField label={t("approvals.detailCheckIn")}>{detail.checkInLabel}</DetailField>
          ) : null}
          <DetailField
            label={
              detail.checkOutLabel
                ? t("approvals.detailCheckOut")
                : t("approvals.receivedColDate")
            }
          >
            {detail.checkOutLabel ?? detail.dateLabel}
          </DetailField>
          {detail.detail ? (
            <DetailField label={t("approvals.detailExtra")}>{detail.detail}</DetailField>
          ) : null}
          <DetailField label={t("approvals.receivedColReason")}>
            <span className="whitespace-pre-wrap break-words">{detail.reason}</span>
          </DetailField>
          <DetailField label={t("approvals.mineColSubmitted")}>{detail.submittedLabel}</DetailField>
          {detail.approverName ? (
            <DetailField label={t("approvals.mineColApprover")}>{detail.approverName}</DetailField>
          ) : null}
          {detail.processedLabel ? (
            <DetailField label={t("approvals.detailProcessed")}>{detail.processedLabel}</DetailField>
          ) : null}
        </dl>

        <div className="flex gap-2 border-t border-[var(--separator)] px-5 py-3 sm:justify-end sm:px-6 sm:py-4">
          {showActions && onApprove && onReject ? (
            <>
              <button type="button" className={`${btnSecondary} flex-1 sm:flex-none`} onClick={onClose}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={`${btnSecondary} flex-1 sm:flex-none`}
                onClick={() => {
                  onReject();
                  onClose();
                }}
              >
                {t("admin.exceptionsReject")}
              </button>
              <button
                type="button"
                className={`${btnSuccess} flex-1 sm:flex-none`}
                onClick={() => {
                  onApprove();
                  onClose();
                }}
              >
                {t("admin.exceptionsApprove")}
              </button>
            </>
          ) : (
            <button type="button" className={`${btnSecondary} flex-1 sm:ml-auto sm:flex-none`} onClick={onClose}>
              {t("common.confirm")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
