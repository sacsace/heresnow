"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  AppleDialogBackdrop,
  AppleDialogHeader,
  AppleDialogPanel,
} from "@/components/ui/appleDialogShared";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ApproverOption = {
  userId: string;
  name: string;
  isTeamLeader: boolean;
};

type Props = {
  open: boolean;
  employeeId: string;
  employeeName: string;
  nextCheckInAt: string | null;
  /** 오늘 이미 이른 출근 신청이 대기 중이면 재신청 UI 숨김 */
  alreadyRequested?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export function DoorEarlyCheckInDialog({
  open,
  employeeId,
  employeeName,
  nextCheckInAt,
  alreadyRequested = false,
  onClose,
  onSubmitted,
}: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"notice" | "request">("notice");
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);
  const [approversLoading, setApproversLoading] = useState(false);
  const [approverUserId, setApproverUserId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("notice");
      setReason("");
      setApproverUserId("");
      setError(null);
      setSubmitting(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, submitting, onClose]);

  const loadApprovers = useCallback(async () => {
    setApproversLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/door/early-check-in-approvers?employeeId=${encodeURIComponent(employeeId)}`
      );
      const j = (await r.json().catch(() => ({}))) as {
        approvers?: ApproverOption[];
        error?: string;
      };
      if (!r.ok) {
        setApprovers([]);
        setError(t("door.earlyCheckInApproverLoadFail"));
        return;
      }
      const list = j.approvers ?? [];
      setApprovers(list);
      setApproverUserId((prev) =>
        prev && list.some((a) => a.userId === prev) ? prev : list[0]?.userId ?? ""
      );
    } catch {
      setApprovers([]);
      setError(t("door.earlyCheckInApproverLoadFail"));
    } finally {
      setApproversLoading(false);
    }
  }, [employeeId, t]);

  async function goRequest() {
    setStep("request");
    await loadApprovers();
  }

  async function submitRequest() {
    if (submitting) return;
    setError(null);
    if (!reason.trim()) {
      setError(t("door.earlyCheckInReasonRequired"));
      return;
    }
    if (!approverUserId) {
      setError(t("approvals.approverRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/door/early-check-in-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          reason: reason.trim(),
          assignedApproverUserId: approverUserId,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!r.ok) {
        if (j.code === "EARLY_CHECK_IN_PENDING") {
          setError(t("door.earlyCheckInAlreadyPending"));
        } else if (j.code === "DUPLICATE_WORK_DATE") {
          setError(t("door.earlyCheckInDuplicateDate"));
        } else if (j.code === "INVALID_APPROVER") {
          setError(t("approvals.approverRequired"));
        } else {
          setError(t("door.earlyCheckInRequestFail"));
        }
        return;
      }
      onSubmitted();
    } catch {
      setError(t("door.earlyCheckInRequestFail"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  const nextLabel = nextCheckInAt
    ? new Date(nextCheckInAt).toLocaleString(dateLocale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const noticeTitle = alreadyRequested
    ? t("door.earlyCheckInAlreadyRequestedTitle")
    : t("door.earlyCheckInTitle");

  const noticeMessage = (() => {
    if (alreadyRequested) {
      const pending = t("door.earlyCheckInAlreadyRequestedMessage");
      if (!employeeName) return pending;
      return t("door.earlyCheckInMessageNamed")
        .replace("{name}", employeeName)
        .replace("{detail}", pending);
    }
    const base = nextLabel
      ? t("door.earlyCheckInMessage").replace("{time}", nextLabel)
      : t("door.checkInTooEarly");
    if (!employeeName) return base;
    return t("door.earlyCheckInMessageNamed")
      .replace("{name}", employeeName)
      .replace("{detail}", base);
  })();

  const showRequestActions = !alreadyRequested;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="door-early-checkin-title"
      aria-describedby="door-early-checkin-message"
    >
      <AppleDialogBackdrop
        onClose={onClose}
        disabled={submitting}
        ariaLabel={t("common.cancel")}
      />

      <AppleDialogPanel className="sm:max-w-[24rem]">
        {step === "notice" || alreadyRequested ? (
          <>
            <AppleDialogHeader
              title={noticeTitle}
              message={noticeMessage}
              variant="warning"
              titleId="door-early-checkin-title"
              messageId="door-early-checkin-message"
            />

            {showRequestActions ? (
              <>
                <div className="flex flex-col border-t border-[var(--separator)] sm:hidden">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void goRequest()}
                    className="touch-manipulation min-h-[3rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] disabled:opacity-40"
                  >
                    {t("door.earlyCheckInRequest")}
                  </button>
                  <div className="h-px bg-[var(--separator)]" />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={onClose}
                    className="touch-manipulation min-h-[3rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] disabled:opacity-40"
                  >
                    {t("common.cancel")}
                  </button>
                </div>

                <div className="hidden items-center justify-end gap-2 border-t border-[var(--separator)] px-5 py-3.5 sm:flex">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={onClose}
                    className="rounded-[0.5rem] px-3.5 py-2 text-[0.8125rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary)] disabled:opacity-40"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void goRequest()}
                    className="rounded-[0.5rem] bg-[var(--apple-blue)] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#0071e3] disabled:opacity-40"
                  >
                    {t("door.earlyCheckInRequest")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col border-t border-[var(--separator)] sm:hidden">
                  <button
                    type="button"
                    onClick={onClose}
                    className="touch-manipulation min-h-[3rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)]"
                  >
                    {t("common.confirm")}
                  </button>
                </div>
                <div className="hidden items-center justify-end gap-2 border-t border-[var(--separator)] px-5 py-3.5 sm:flex">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-[0.5rem] bg-[var(--apple-blue)] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#0071e3]"
                  >
                    {t("common.confirm")}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="px-5 pb-2 pt-5 text-center">
              <h2
                id="door-early-checkin-title"
                className="text-[1.0625rem] font-semibold text-[var(--foreground)]"
              >
                {t("door.earlyCheckInRequestTitle")}
              </h2>
              <p
                id="door-early-checkin-message"
                className="mt-2 whitespace-pre-line text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]"
              >
                {t("door.earlyCheckInRequestLead")}
              </p>
            </div>

            <div className="space-y-3 px-5 pb-4">
              <label className="block text-left">
                <span className="mb-1.5 block text-[0.75rem] font-medium text-[var(--apple-label-secondary)]">
                  {t("approvals.approverSelectLabel")}
                </span>
                <select
                  className="w-full rounded-[0.625rem] border border-[var(--separator)] bg-[var(--background)] px-3 py-2.5 text-[0.9375rem] text-[var(--foreground)] outline-none focus:border-[var(--apple-blue)]"
                  value={approverUserId}
                  disabled={approversLoading || submitting || approvers.length === 0}
                  onChange={(e) => setApproverUserId(e.target.value)}
                >
                  {approversLoading ? (
                    <option value="">{t("common.loading")}</option>
                  ) : approvers.length === 0 ? (
                    <option value="">{t("approvals.approverEmpty")}</option>
                  ) : (
                    <>
                      <option value="">{t("approvals.approverSelectPlaceholder")}</option>
                      {approvers.map((a) => (
                        <option key={a.userId} value={a.userId}>
                          {a.isTeamLeader
                            ? t("approvals.approverOptionTeamLeader").replace("{name}", a.name)
                            : a.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[0.75rem] font-medium text-[var(--apple-label-secondary)]">
                  {t("approvals.mineColReason")}
                </span>
                <textarea
                  rows={3}
                  value={reason}
                  disabled={submitting}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("door.earlyCheckInReasonPlaceholder")}
                  className="w-full resize-none rounded-[0.625rem] border border-[var(--separator)] bg-[var(--background)] px-3 py-2.5 text-[0.9375rem] text-[var(--foreground)] outline-none placeholder:text-[var(--apple-label-tertiary)] focus:border-[var(--apple-blue)]"
                />
              </label>

              {error ? (
                <p className="text-center text-[0.8125rem] text-[var(--apple-red)]">{error}</p>
              ) : null}
            </div>

            <div className="flex flex-col border-t border-[var(--separator)] sm:hidden">
              <button
                type="button"
                disabled={submitting || approversLoading || approvers.length === 0}
                onClick={() => void submitRequest()}
                className="touch-manipulation min-h-[3rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] disabled:opacity-40"
              >
                {submitting ? t("common.processing") : t("approvals.submitButton")}
              </button>
              <div className="h-px bg-[var(--separator)]" />
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="touch-manipulation min-h-[3rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] disabled:opacity-40"
              >
                {t("common.cancel")}
              </button>
            </div>

            <div className="hidden items-center justify-end gap-2 border-t border-[var(--separator)] px-5 py-3.5 sm:flex">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-[0.5rem] px-3.5 py-2 text-[0.8125rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary)] disabled:opacity-40"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || approversLoading || approvers.length === 0}
                onClick={() => void submitRequest()}
                className="rounded-[0.5rem] bg-[var(--apple-blue)] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#0071e3] disabled:opacity-40"
              >
                {submitting ? t("common.processing") : t("approvals.submitButton")}
              </button>
            </div>
          </>
        )}
      </AppleDialogPanel>
    </div>,
    document.body
  );
}
