"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  bannerSuccess,
  bannerWarning,
  btnPrimary,
  btnSecondary,
  hint,
  input,
  label,
  select,
} from "@/lib/uiStyles";
import type { WorkRequestType } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

type ApproverOption = {
  userId: string;
  name: string;
  role: string;
  isTeamLeader: boolean;
};

type Props = {
  overtimeApplicationEnabled?: boolean;
  onSubmitted?: () => void;
  onCancel?: () => void;
};

/** `<input type="date">` — 브라우저 로컬 오늘 (API 응답 전 즉시 표시용) */
function localTodayDateInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WorkRequestApplyForm({
  overtimeApplicationEnabled = true,
  onSubmitted,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [requestType, setRequestType] = useState<WorkRequestType>(
    overtimeApplicationEnabled ? "OVERTIME" : "EARLY_LEAVE"
  );
  const [workDate, setWorkDate] = useState(localTodayDateInputValue);
  const [reason, setReason] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [assignedApproverUserId, setAssignedApproverUserId] = useState("");
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);
  const [approversLoading, setApproversLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOvertime = requestType === "OVERTIME";

  const loadApprovers = useCallback(async () => {
    setApproversLoading(true);
    const r = await fetch("/api/employee/work-request-approvers");
    const j = (await r.json().catch(() => ({}))) as {
      approvers?: ApproverOption[];
      todayWorkDate?: string;
    };
    if (r.ok) {
      const list = j.approvers ?? [];
      setApprovers(list);
      if (typeof j.todayWorkDate === "string" && j.todayWorkDate) {
        setWorkDate(j.todayWorkDate);
      }
      setAssignedApproverUserId((prev) =>
        prev && list.some((a) => a.userId === prev) ? prev : ""
      );
    } else {
      setApprovers([]);
      setAssignedApproverUserId("");
    }
    setApproversLoading(false);
  }, []);

  useEffect(() => {
    void loadApprovers();
  }, [loadApprovers]);

  useEffect(() => {
    if (!overtimeApplicationEnabled && requestType === "OVERTIME") {
      setRequestType("EARLY_LEAVE");
    }
  }, [overtimeApplicationEnabled, requestType]);

  function approverLabel(option: ApproverOption) {
    if (option.isTeamLeader) {
      return t("approvals.approverOptionTeamLeader").replace("{name}", option.name);
    }
    return option.name;
  }

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
    if (!assignedApproverUserId) {
      setError(t("approvals.approverRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/employee/work-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: requestType,
          workDate: workDate.trim(),
          reason: reason.trim(),
          assignedApproverUserId,
          ...(isOvertime ? { extraMinutes: Number(extraMinutes) } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!r.ok) {
        if (j.code === "DUPLICATE_WORK_DATE") {
          setError(t("approvals.duplicateWorkDate"));
        } else {
          setError(typeof j.error === "string" ? j.error : t("employee.workRequestSubmitFail"));
        }
        return;
      }
      setMsg(t("employee.workRequestSubmitOk"));
      setReason("");
      setExtraMinutes("");
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--separator)] bg-white p-4 sm:p-5">
      <div>
        <p className={label}>{t("approvals.workRequestTypeLabel")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label
            className={`inline-flex items-center gap-2 rounded-full bg-[var(--fill-secondary)] px-3 py-1.5 text-[0.8125rem] font-medium ${
              overtimeApplicationEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <input
              type="radio"
              name="requestType"
              className="accent-[var(--apple-blue)]"
              checked={requestType === "OVERTIME"}
              onChange={() => setRequestType("OVERTIME")}
              disabled={submitting || !overtimeApplicationEnabled}
            />
            {t("approvals.workRequestTypeOvertime")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--fill-secondary)] px-3 py-1.5 text-[0.8125rem] font-medium">
            <input
              type="radio"
              name="requestType"
              className="accent-[var(--apple-blue)]"
              checked={requestType === "EARLY_LEAVE"}
              onChange={() => setRequestType("EARLY_LEAVE")}
              disabled={submitting}
            />
            {t("approvals.workRequestTypeEarlyLeave")}
          </label>
        </div>
      </div>

      <div>
        <label className={label}>{t("employee.workRequestDateLabel")}</label>
        <input
          type="date"
          className={`${input} mt-1.5`}
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          required
          disabled={submitting}
        />
      </div>

      <div>
        <label className={label}>{t("approvals.approverSelectLabel")}</label>
        {approversLoading ? (
          <p className={`${hint} mt-1.5`}>{t("common.loading")}</p>
        ) : approvers.length === 0 ? (
          <p className={`${bannerWarning} mt-1.5`}>{t("approvals.approverEmpty")}</p>
        ) : (
          <select
            className={`${select} mt-1.5 w-full`}
            value={assignedApproverUserId}
            onChange={(e) => setAssignedApproverUserId(e.target.value)}
            required
            disabled={submitting}
          >
            <option value="" disabled>
              {t("approvals.approverSelectPlaceholder")}
            </option>
            {approvers.map((option) => (
              <option key={option.userId} value={option.userId}>
                {approverLabel(option)}
              </option>
            ))}
          </select>
        )}
      </div>

      {isOvertime && (
        <div>
          <label className={label}>{t("employee.overtimeMinutesLabel")}</label>
          <input
            type="number"
            min={1}
            max={1440}
            className={`${input} mt-1.5`}
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
          className={`${input} mt-1.5 min-h-[5rem]`}
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

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={btnPrimary}
          disabled={submitting || approvers.length === 0}
        >
          {submitting ? t("common.loading") : t("approvals.submitButton")}
        </button>
        {onCancel ? (
          <button type="button" className={btnSecondary} disabled={submitting} onClick={onCancel}>
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
      <p className={hint}>
        {!overtimeApplicationEnabled
          ? t("employee.overtimeRequestDisabled")
          : isOvertime
            ? t("employee.overtimeRequestLead")
            : t("employee.earlyLeaveRequestLead")}
      </p>
    </form>
  );
}
