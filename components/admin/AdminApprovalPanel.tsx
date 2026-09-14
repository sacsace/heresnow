"use client";

import {
  WorkRequestDetailModal,
  type WorkRequestDetail,
} from "@/components/approvals/WorkRequestDetailModal";
import {
  matchesWorkRequestFilters,
  toCalendarDay,
  type WorkRequestListFilters,
} from "@/components/approvals/workRequestFilters";
import { useI18n } from "@/components/LanguageProvider";
import { statusBadge } from "@/lib/statusBadge";
import {
  btnSecondary,
  btnSuccess,
  emptyState,
  hint,
  table,
  tableHead,
  tableRow,
  td,
  th,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ReceivedView = "pending" | "history";

type WorkRequestRow = {
  id: string;
  type: "EARLY_LEAVE" | "OVERTIME";
  workDate: string;
  reason: string;
  extraMinutes: number | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  employee: { name: string };
  assignedApproverName?: string | null;
  resolverName?: string | null;
  canApprove?: boolean;
};

type ExceptionRow = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  checkInAt?: string | null;
  attendance: {
    type: string;
    timestamp: string;
    isEarlyLeave: boolean;
    isOvertime: boolean;
    employee: { name: string };
    site: { name: string } | null;
  };
};

type ListRow = {
  key: string;
  source: "advance" | "punch";
  employeeName: string;
  typeLabel: string;
  dateLabel: string;
  detail: string;
  reason: string;
  status: string;
  processedLabel: string;
  canApprove: boolean;
  actionKind: "work" | "exception";
  actionId: string;
  sortTime: number;
  searchText: string;
  filterDate: string;
  requestType: "EARLY_LEAVE" | "OVERTIME";
  modalDetail: WorkRequestDetail;
};

type Props = {
  kind: "early-leave" | "overtime" | "all";
  view: ReceivedView;
  filters: WorkRequestListFilters;
};

export function AdminApprovalPanel({ kind, view, filters }: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const [requests, setRequests] = useState<WorkRequestRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<{
    detail: WorkRequestDetail;
    canApprove: boolean;
    actionKind: "work" | "exception";
    actionId: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const status = view === "history" ? "resolved" : "pending";
    const r = await fetch(`/api/admin/approvals?kind=${kind}&status=${status}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setRequests((j as { requests?: WorkRequestRow[] }).requests ?? []);
      setExceptions((j as { exceptions?: ExceptionRow[] }).exceptions ?? []);
    } else {
      setRequests([]);
      setExceptions([]);
    }
    setLoading(false);
  }, [kind, view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveWorkRequest(id: string, action: "approve" | "reject") {
    const r = await fetch(`/api/admin/work-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (r.ok) await load();
  }

  async function resolveException(id: string, action: "approve" | "reject") {
    const r = await fetch(`/api/admin/exceptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (r.ok) await load();
  }

  function requestTypeLabel(type: WorkRequestRow["type"]) {
    return type === "OVERTIME"
      ? t("approvals.workRequestTypeOvertime")
      : t("approvals.workRequestTypeEarlyLeave");
  }

  function exceptionTypeLabel(row: ExceptionRow) {
    if (row.attendance.isEarlyLeave) return t("approvals.workRequestTypeEarlyLeave");
    if (row.attendance.isOvertime) return t("approvals.workRequestTypeOvertime");
    return t("admin.exceptionsTypeCheckOut");
  }

  function statusLabel(status: string) {
    if (status === "PENDING") return t("employee.workRequestStatusPending");
    if (status === "APPROVED") return t("employee.workRequestStatusApproved");
    if (status === "REJECTED") return t("employee.workRequestStatusRejected");
    return status;
  }

  function formatWhen(iso: string | null | undefined) {
    if (!iso) return "";
    return new Date(iso).toLocaleString(dateLocale);
  }

  const rows = useMemo(() => {
    const list: ListRow[] = [];

    for (const item of requests) {
      const typeLabel = requestTypeLabel(item.type);
      const detail =
        item.type === "OVERTIME" && item.extraMinutes
          ? t("employee.overtimeMinutesShort").replace("{n}", String(item.extraMinutes))
          : item.assignedApproverName
            ? t("approvals.assignedApproverShort").replace("{name}", item.assignedApproverName)
            : "";
      const processedLabel =
        item.resolvedAt && item.resolverName
          ? `${formatWhen(item.resolvedAt)} · ${t("approvals.resolvedByShort").replace("{name}", item.resolverName)}`
          : item.resolvedAt
            ? formatWhen(item.resolvedAt)
            : formatWhen(item.createdAt);

      const canApprove = view === "pending" && item.canApprove !== false;
      list.push({
        key: `w-${item.id}`,
        source: "advance",
        employeeName: item.employee.name,
        typeLabel,
        dateLabel: item.workDate,
        detail,
        reason: item.reason,
        status: item.status,
        processedLabel,
        canApprove,
        actionKind: "work",
        actionId: item.id,
        sortTime: new Date(item.resolvedAt ?? item.createdAt).getTime(),
        filterDate: item.workDate,
        requestType: item.type,
        searchText: [
          item.employee.name,
          typeLabel,
          item.workDate,
          item.reason,
          detail,
          statusLabel(item.status),
          t("approvals.receivedSourceAdvance"),
        ]
          .join(" ")
          .toLowerCase(),
        modalDetail: {
          typeLabel,
          sourceLabel: t("approvals.receivedSourceAdvance"),
          employeeName: item.employee.name,
          dateLabel: item.workDate,
          detail: detail || undefined,
          reason: item.reason,
          status: item.status,
          submittedLabel: formatWhen(item.createdAt),
          approverName: item.assignedApproverName,
          processedLabel: item.resolvedAt ? processedLabel : undefined,
        },
      });
    }

    for (const x of exceptions) {
      const typeLabel = exceptionTypeLabel(x);
      const detail = [
        t("admin.exceptionsTypeCheckOut"),
        x.attendance.site?.name ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      const processedLabel = x.resolvedAt ? formatWhen(x.resolvedAt) : formatWhen(x.createdAt);

      const canApprove = view === "pending";
      const requestType: "EARLY_LEAVE" | "OVERTIME" = x.attendance.isEarlyLeave
        ? "EARLY_LEAVE"
        : "OVERTIME";
      list.push({
        key: `e-${x.id}`,
        source: "punch",
        employeeName: x.attendance.employee.name,
        typeLabel,
        dateLabel: formatWhen(x.attendance.timestamp),
        detail,
        reason: x.reason,
        status: x.status,
        processedLabel,
        canApprove,
        actionKind: "exception",
        actionId: x.id,
        sortTime: new Date(x.resolvedAt ?? x.createdAt).getTime(),
        filterDate: toCalendarDay(x.attendance.timestamp),
        requestType,
        searchText: [
          x.attendance.employee.name,
          typeLabel,
          detail,
          x.reason,
          statusLabel(x.status),
          t("approvals.receivedSourcePunch"),
        ]
          .join(" ")
          .toLowerCase(),
        modalDetail: {
          typeLabel,
          sourceLabel: t("approvals.receivedSourcePunch"),
          employeeName: x.attendance.employee.name,
          dateLabel: formatWhen(x.attendance.timestamp),
          checkInLabel: x.checkInAt ? formatWhen(x.checkInAt) : undefined,
          checkOutLabel: formatWhen(x.attendance.timestamp),
          detail: detail || undefined,
          reason: x.reason,
          status: x.status,
          submittedLabel: formatWhen(x.createdAt),
          processedLabel: x.resolvedAt ? processedLabel : undefined,
        },
      });
    }

    list.sort((a, b) => b.sortTime - a.sortTime);
    return list;
  }, [requests, exceptions, view, t, dateLocale]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        matchesWorkRequestFilters({
          filterDate: row.filterDate,
          requestType: row.requestType,
          searchText: row.searchText,
          filters,
        })
      ),
    [rows, filters]
  );

  const empty = !loading && rows.length === 0;
  const searchEmpty = !loading && rows.length > 0 && filteredRows.length === 0;

  if (loading) {
    return <p className={`${hint} px-5 py-6 sm:px-6`}>{t("common.loading")}</p>;
  }

  if (empty) {
    return (
      <p className={`${emptyState} px-5 py-6 sm:px-6`}>
        {view === "history"
          ? t("approvals.receivedHistoryEmpty")
          : t("admin.approvalsEmpty")}
      </p>
    );
  }

  if (searchEmpty) {
    return <p className={`${emptyState} px-5 py-6 sm:px-6`}>{t("approvals.receivedSearchEmpty")}</p>;
  }

  return (
    <>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th className={th}>{t("approvals.receivedColSource")}</th>
            <th className={th}>{t("approvals.receivedColEmployee")}</th>
            <th className={th}>{t("approvals.receivedColType")}</th>
            <th className={th}>{t("approvals.receivedColDate")}</th>
            <th className={th}>{t("approvals.receivedColReason")}</th>
            <th className={th}>{t("approvals.receivedColStatus")}</th>
            <th className={th}>{t("approvals.receivedColProcessed")}</th>
            {view === "pending" ? <th className={th}>{t("approvals.receivedColActions")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr
              key={row.key}
              className={`${tableRow} cursor-pointer`}
              onClick={() =>
                setSelectedDetail({
                  detail: row.modalDetail,
                  canApprove: row.canApprove,
                  actionKind: row.actionKind,
                  actionId: row.actionId,
                })
              }
            >
              <td className={`${td} text-[0.8125rem] text-[var(--apple-label-secondary)]`}>
                {row.source === "advance"
                  ? t("approvals.receivedSourceAdvance")
                  : t("approvals.receivedSourcePunch")}
              </td>
              <td className={`${td} font-semibold`}>{row.employeeName}</td>
              <td className={td}>
                <div>{row.typeLabel}</div>
                {row.detail ? (
                  <div className="mt-0.5 text-[0.75rem] text-[var(--apple-label-tertiary)]">
                    {row.detail}
                  </div>
                ) : null}
              </td>
              <td className={`${td} whitespace-nowrap text-[0.875rem] tabular-nums`}>
                {row.dateLabel}
              </td>
              <td className={`${td} max-w-[16rem] text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                {row.reason}
              </td>
              <td className={td}>
                <span className={statusBadge(row.status)}>{statusLabel(row.status)}</span>
              </td>
              <td className={`${td} whitespace-nowrap text-[0.8125rem] text-[var(--apple-label-secondary)]`}>
                {row.processedLabel}
              </td>
              {view === "pending" ? (
                <td className={td} onClick={(e) => e.stopPropagation()}>
                  {row.canApprove ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`${btnSuccess} !px-3 !py-1.5 text-[0.8125rem]`}
                        onClick={() =>
                          void (row.actionKind === "work"
                            ? resolveWorkRequest(row.actionId, "approve")
                            : resolveException(row.actionId, "approve"))
                        }
                      >
                        {t("admin.exceptionsApprove")}
                      </button>
                      <button
                        type="button"
                        className={`${btnSecondary} !px-3 !py-1.5 text-[0.8125rem]`}
                        onClick={() =>
                          void (row.actionKind === "work"
                            ? resolveWorkRequest(row.actionId, "reject")
                            : resolveException(row.actionId, "reject"))
                        }
                      >
                        {t("admin.exceptionsReject")}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[0.8125rem] text-[var(--apple-label-tertiary)]">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <WorkRequestDetailModal
        open={selectedDetail !== null}
        onClose={() => setSelectedDetail(null)}
        detail={selectedDetail?.detail ?? null}
        statusLabel={statusLabel}
        showActions={selectedDetail?.canApprove}
        onApprove={
          selectedDetail
            ? () =>
                void (selectedDetail.actionKind === "work"
                  ? resolveWorkRequest(selectedDetail.actionId, "approve")
                  : resolveException(selectedDetail.actionId, "approve"))
            : undefined
        }
        onReject={
          selectedDetail
            ? () =>
                void (selectedDetail.actionKind === "work"
                  ? resolveWorkRequest(selectedDetail.actionId, "reject")
                  : resolveException(selectedDetail.actionId, "reject"))
            : undefined
        }
      />
    </>
  );
}
