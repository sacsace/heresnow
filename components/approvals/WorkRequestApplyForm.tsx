"use client";

import { useI18n } from "@/components/LanguageProvider";
import { AppleAlertDialog } from "@/components/ui/AppleAlertDialog";
import {
  addDaysToYmd,
  vacationRangeIncludesDay,
} from "@/lib/workRequestDates";
import {
  WORK_REQUEST_TYPES,
  workRequestTypeLabel,
} from "@/lib/workRequestTypes";
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
import { useCallback, useEffect, useMemo, useState } from "react";

type ApproverOption = {
  userId: string;
  name: string;
  role: string;
  isTeamLeader: boolean;
};

type Props = {
  overtimeApplicationEnabled?: boolean;
  /** groupedCard 내부 — 바깥 테두리·패딩 제거 */
  embedded?: boolean;
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
  embedded = false,
  onSubmitted,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [requestType, setRequestType] = useState<WorkRequestType>(
    overtimeApplicationEnabled ? "OVERTIME" : "EARLY_LEAVE"
  );
  const [workDate, setWorkDate] = useState(localTodayDateInputValue);
  const [workEndDate, setWorkEndDate] = useState(localTodayDateInputValue);
  const [reason, setReason] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [assignedApproverUserId, setAssignedApproverUserId] = useState("");
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);
  const [approversLoading, setApproversLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todayWorkDate, setTodayWorkDate] = useState<string | null>(null);
  const [sameDayVacationAlertOpen, setSameDayVacationAlertOpen] = useState(false);

  const isOvertime = requestType === "OVERTIME";
  const isVacation = requestType === "VACATION";

  const availableTypes = useMemo(
    () =>
      WORK_REQUEST_TYPES.filter(
        (type) => type !== "OVERTIME" || overtimeApplicationEnabled
      ),
    [overtimeApplicationEnabled]
  );

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
        setTodayWorkDate(j.todayWorkDate);
        setWorkDate(j.todayWorkDate);
        setWorkEndDate(j.todayWorkDate);
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
    if (!availableTypes.includes(requestType)) {
      setRequestType(availableTypes[0] ?? "EARLY_LEAVE");
    }
  }, [availableTypes, requestType]);

  const vacationMinStartDate = useMemo(() => {
    const base = todayWorkDate ?? localTodayDateInputValue();
    return addDaysToYmd(base, 1);
  }, [todayWorkDate]);

  useEffect(() => {
    if (!isVacation) return;
    setWorkDate((prev) => {
      if (!prev || prev < vacationMinStartDate) return vacationMinStartDate;
      return prev;
    });
  }, [isVacation, vacationMinStartDate]);

  useEffect(() => {
    if (!isVacation) return;
    const minEnd = workDate >= vacationMinStartDate ? workDate : vacationMinStartDate;
    setWorkEndDate((prev) => {
      if (!prev || prev < minEnd) return minEnd;
      return prev;
    });
  }, [isVacation, vacationMinStartDate, workDate]);

  function isSameDayVacationRequest(start: string, end: string): boolean {
    const today = todayWorkDate ?? localTodayDateInputValue();
    return vacationRangeIncludesDay({ workDate: start, workEndDate: end, day: today });
  }

  function approverLabel(option: ApproverOption) {
    if (option.isTeamLeader) {
      return t("approvals.approverOptionTeamLeader").replace("{name}", option.name);
    }
    return option.name;
  }

  function reasonPlaceholder(type: WorkRequestType) {
    if (type === "OVERTIME") return t("employee.overtimeReasonPlaceholder");
    if (type === "EARLY_LEAVE") return t("employee.earlyLeaveReasonPlaceholder");
    if (type === "REMOTE_WORK") return t("approvals.remoteWorkReasonPlaceholder");
    if (type === "VACATION") return t("approvals.vacationReasonPlaceholder");
    if (type === "HALF_DAY_LEAVE") return t("approvals.halfDayReasonPlaceholder");
    return t("approvals.workRequestReasonPlaceholder");
  }

  function formLead(type: WorkRequestType) {
    if (type === "OVERTIME") return t("employee.overtimeRequestLead");
    if (type === "EARLY_LEAVE") return t("employee.earlyLeaveRequestLead");
    if (type === "REMOTE_WORK") return t("approvals.remoteWorkRequestLead");
    if (type === "VACATION") return t("approvals.vacationRequestLead");
    if (type === "HALF_DAY_LEAVE") return t("approvals.halfDayRequestLead");
    return t("approvals.workRequestGenericLead");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (!workDate.trim() || !reason.trim()) {
      setError(t("employee.workRequestRequired"));
      return;
    }
    if (isVacation) {
      if (!workEndDate.trim()) {
        setError(t("approvals.vacationEndDateRequired"));
        return;
      }
      if (workEndDate < workDate) {
        setError(t("approvals.vacationEndDateInvalid"));
        return;
      }
      if (isSameDayVacationRequest(workDate.trim(), workEndDate.trim())) {
        setSameDayVacationAlertOpen(true);
        return;
      }
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
          ...(isVacation ? { workEndDate: workEndDate.trim() } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!r.ok) {
        if (j.code === "DUPLICATE_WORK_DATE") {
          setError(t("approvals.duplicateWorkDate"));
        } else if (j.code === "VACATION_SAME_DAY_FORBIDDEN") {
          setSameDayVacationAlertOpen(true);
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
    <form
      onSubmit={onSubmit}
      className={
        embedded
          ? "space-y-4"
          : "space-y-4 rounded-2xl border border-[var(--separator)] bg-white p-4 sm:p-5"
      }
    >
      <div>
        <p className={label}>{t("approvals.workRequestTypeLabel")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableTypes.map((type) => (
            <label
              key={type}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--fill-secondary)] px-3 py-1.5 text-[0.8125rem] font-medium"
            >
              <input
                type="radio"
                name="requestType"
                className="accent-[var(--apple-blue)]"
                checked={requestType === type}
                onChange={() => setRequestType(type)}
                disabled={submitting}
              />
              {workRequestTypeLabel(type, t)}
            </label>
          ))}
        </div>
      </div>

      {isVacation ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{t("approvals.vacationStartDateLabel")}</label>
            <input
              type="date"
              className={`${input} mt-1.5`}
              value={workDate}
              min={vacationMinStartDate}
              onChange={(e) => {
                const next = e.target.value;
                setWorkDate(next);
                if (workEndDate < next) setWorkEndDate(next);
              }}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <label className={label}>{t("approvals.vacationEndDateLabel")}</label>
            <input
              type="date"
              className={`${input} mt-1.5`}
              value={workEndDate}
              min={workDate}
              onChange={(e) => setWorkEndDate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
        </div>
      ) : (
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
      )}

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
          placeholder={reasonPlaceholder(requestType)}
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
        {!overtimeApplicationEnabled && requestType === "OVERTIME"
          ? t("employee.overtimeRequestDisabled")
          : formLead(requestType)}
      </p>

      <AppleAlertDialog
        open={sameDayVacationAlertOpen}
        variant="warning"
        title={t("approvals.vacationSameDayTitle")}
        message={t("approvals.vacationSameDayMessage")}
        onClose={() => setSameDayVacationAlertOpen(false)}
      />
    </form>
  );
}
