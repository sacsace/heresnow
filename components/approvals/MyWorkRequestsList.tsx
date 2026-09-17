"use client";

import {
  WorkRequestDetailModal,
  type WorkRequestDetail,
} from "@/components/approvals/WorkRequestDetailModal";
import {
  matchesWorkRequestFilters,
  type WorkRequestListFilters,
} from "@/components/approvals/workRequestFilters";
import { useI18n } from "@/components/LanguageProvider";
import { statusBadge } from "@/lib/statusBadge";
import {
  emptyState,
  hint,
  table,
  tableHead,
  tableRow,
  td,
  th,
} from "@/lib/uiStyles";
import { formatWorkRequestDateRange } from "@/lib/workRequestDates";
import { workRequestTypeLabel } from "@/lib/workRequestTypes";
import type { WorkRequestType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type WorkRequestRow = {
  id: string;
  type: WorkRequestType;
  workDate: string;
  workEndDate?: string | null;
  reason: string;
  extraMinutes: number | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  assignedApproverName?: string | null;
};

type Props = {
  refreshKey?: number;
  filters: WorkRequestListFilters;
};

export function MyWorkRequestsList({ refreshKey = 0, filters }: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const [items, setItems] = useState<WorkRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<WorkRequestDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/employee/work-requests");
    const j = await r.json().catch(() => ({}));
    if (r.ok) setItems((j as { requests?: WorkRequestRow[] }).requests ?? []);
    else setItems([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function typeLabel(type: WorkRequestType) {
    return workRequestTypeLabel(type, t);
  }

  function statusLabel(status: string) {
    if (status === "PENDING") return t("employee.workRequestStatusPending");
    if (status === "APPROVED") return t("employee.workRequestStatusApproved");
    if (status === "REJECTED") return t("employee.workRequestStatusRejected");
    return status;
  }

  function buildDetail(item: WorkRequestRow): WorkRequestDetail {
    const extraDetail =
      item.type === "OVERTIME" && item.extraMinutes
        ? t("employee.overtimeMinutesShort").replace("{n}", String(item.extraMinutes))
        : undefined;
    return {
      typeLabel: typeLabel(item.type),
      dateLabel: formatWorkRequestDateRange(item.workDate, item.workEndDate),
      detail: extraDetail,
      reason: item.reason,
      status: item.status,
      submittedLabel: new Date(item.createdAt).toLocaleString(dateLocale),
      approverName: item.assignedApproverName,
      processedLabel: item.resolvedAt
        ? new Date(item.resolvedAt).toLocaleString(dateLocale)
        : undefined,
    };
  }

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const searchText = [
          typeLabel(item.type),
          formatWorkRequestDateRange(item.workDate, item.workEndDate),
          item.reason,
          statusLabel(item.status),
          item.assignedApproverName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return matchesWorkRequestFilters({
          filterDate: item.workDate,
          filterEndDate: item.workEndDate,
          requestType: item.type,
          searchText,
          filters,
        });
      }),
    [items, filters, t]
  );

  if (loading) {
    return <p className={`${hint} px-5 py-6 sm:px-6`}>{t("common.loading")}</p>;
  }

  if (items.length === 0) {
    return <p className={`${emptyState} px-5 py-6 sm:px-6`}>{t("employee.workRequestEmpty")}</p>;
  }

  if (filteredItems.length === 0) {
    return <p className={`${emptyState} px-5 py-6 sm:px-6`}>{t("approvals.mineSearchEmpty")}</p>;
  }

  return (
    <>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th className={th}>{t("approvals.mineColType")}</th>
            <th className={th}>{t("approvals.mineColWorkDate")}</th>
            <th className={th}>{t("approvals.mineColSubmitted")}</th>
            <th className={th}>{t("approvals.mineColStatus")}</th>
            <th className={th}>{t("approvals.mineColApprover")}</th>
            <th className={th}>{t("approvals.mineColReason")}</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr
              key={item.id}
              className={`${tableRow} cursor-pointer`}
              onClick={() => setSelectedDetail(buildDetail(item))}
            >
              <td className={td}>
                <div>{typeLabel(item.type)}</div>
                {item.type === "OVERTIME" && item.extraMinutes ? (
                  <div className="mt-0.5 text-[0.75rem] text-[var(--apple-label-tertiary)]">
                    {t("employee.overtimeMinutesShort").replace("{n}", String(item.extraMinutes))}
                  </div>
                ) : null}
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {formatWorkRequestDateRange(item.workDate, item.workEndDate)}
              </td>
              <td className={`${td} whitespace-nowrap text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                {new Date(item.createdAt).toLocaleString(dateLocale)}
              </td>
              <td className={td}>
                <span className={statusBadge(item.status)}>{statusLabel(item.status)}</span>
              </td>
              <td className={`${td} text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                {item.assignedApproverName ?? "—"}
              </td>
              <td className={`${td} max-w-[18rem] text-[0.875rem] text-[var(--apple-label-secondary)]`}>
                {item.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <WorkRequestDetailModal
        open={selectedDetail !== null}
        onClose={() => setSelectedDetail(null)}
        detail={selectedDetail}
        statusLabel={statusLabel}
      />
    </>
  );
}
