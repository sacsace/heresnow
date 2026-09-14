"use client";

import {
  AdminApprovalPanel,
  type ReceivedView,
} from "@/components/admin/AdminApprovalPanel";
import { MyWorkRequestsList } from "@/components/approvals/MyWorkRequestsList";
import { WorkRequestApplyForm } from "@/components/approvals/WorkRequestApplyForm";
import { useI18n } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  defaultWorkRequestListFilters,
  type WorkRequestListFilters,
  type WorkRequestTypeFilter,
} from "@/components/approvals/workRequestFilters";
import {
  btnPrimary,
  inputToolbar,
  label,
  pageStack,
  searchFieldCol,
  searchFieldWrap,
  segmentedToolbarBtn,
  segmentedToolbarWrap,
  tableToolbar,
  tableWrap,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "received" | "mine";

type Props = {
  /** Admin chrome already shows page lead — hide duplicate subtitle */
  hidePageLead?: boolean;
};

export function AttendanceRequestsPage({ hidePageLead = false }: Props) {
  const { t, locale } = useI18n();
  const [canReceive, setCanReceive] = useState(false);
  const [tab, setTab] = useState<Tab>("mine");
  const [receivedView, setReceivedView] = useState<ReceivedView>("pending");
  const [filters, setFilters] = useState<WorkRequestListFilters>(() => defaultWorkRequestListFilters());
  const [applying, setApplying] = useState(false);
  const [mineRefreshKey, setMineRefreshKey] = useState(0);
  const [overtimeApplicationEnabled, setOvertimeApplicationEnabled] = useState(true);

  const loadPolicy = useCallback(async () => {
    const r = await fetch("/api/employee/work-requests");
    const j = (await r.json().catch(() => ({}))) as {
      policy?: { overtimeApplicationEnabled?: boolean; canReceiveRequests?: boolean };
    };
    if (r.ok) {
      setOvertimeApplicationEnabled(j.policy?.overtimeApplicationEnabled !== false);
      setCanReceive(Boolean(j.policy?.canReceiveRequests));
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    setFilters(defaultWorkRequestListFilters());
  }, [tab, receivedView]);

  const scopeTabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string }> = [{ id: "mine", label: t("approvals.tabMine") }];
    if (canReceive) {
      list.unshift({ id: "received", label: t("approvals.tabReceived") });
    }
    return list;
  }, [canReceive, t]);

  const searchPlaceholder =
    tab === "received"
      ? t("approvals.receivedSearchPlaceholder")
      : t("approvals.mineSearchPlaceholder");

  const typeOptions = useMemo(
    (): Array<{ id: WorkRequestTypeFilter; label: string }> => [
      { id: "all", label: t("approvals.filterTypeAll") },
      { id: "OVERTIME", label: t("approvals.workRequestTypeOvertime") },
      { id: "EARLY_LEAVE", label: t("approvals.workRequestTypeEarlyLeave") },
    ],
    [t]
  );

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  return (
    <div className={pageStack}>
      <PageHeader
        title={t("approvals.navTitle")}
        subtitle={hidePageLead ? undefined : t("approvals.navLead")}
        actions={
          !applying ? (
            <button type="button" className={btnPrimary} onClick={() => setApplying(true)}>
              {t("approvals.applyButton")}
            </button>
          ) : undefined
        }
      />

      {applying ? (
        <WorkRequestApplyForm
          overtimeApplicationEnabled={overtimeApplicationEnabled}
          onSubmitted={() => {
            setMineRefreshKey((k) => k + 1);
            setApplying(false);
            setTab("mine");
          }}
          onCancel={() => setApplying(false)}
        />
      ) : (
        <div className={tableWrap}>
          <div className={tableToolbar}>
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className={segmentedToolbarWrap} role="tablist" aria-label={t("approvals.navTitle")}>
                {scopeTabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={segmentedToolbarBtn(tab === item.id)}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {tab === "received" && canReceive ? (
                <>
                  <span
                    className="hidden h-5 w-px shrink-0 bg-[var(--separator)] sm:inline-block"
                    aria-hidden
                  />
                  <div
                    className={segmentedToolbarWrap}
                    role="group"
                    aria-label={t("approvals.receivedFilterPending")}
                  >
                    <button
                      type="button"
                      className={segmentedToolbarBtn(receivedView === "pending")}
                      aria-pressed={receivedView === "pending"}
                      onClick={() => setReceivedView("pending")}
                    >
                      {t("approvals.receivedFilterPending")}
                    </button>
                    <button
                      type="button"
                      className={segmentedToolbarBtn(receivedView === "history")}
                      aria-pressed={receivedView === "history"}
                      onClick={() => setReceivedView("history")}
                    >
                      {t("approvals.receivedFilterHistory")}
                    </button>
                  </div>
                </>
              ) : null}

              <span
                className="hidden h-5 w-px shrink-0 bg-[var(--separator)] sm:inline-block"
                aria-hidden
              />

              <div
                className={segmentedToolbarWrap}
                role="group"
                aria-label={t("approvals.workRequestTypeLabel")}
              >
                {typeOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={segmentedToolbarBtn(filters.typeFilter === item.id)}
                    aria-pressed={filters.typeFilter === item.id}
                    onClick={() => setFilters((prev) => ({ ...prev, typeFilter: item.id }))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                <label className={label} htmlFor="approvals-date-from">
                  {t("admin.attendanceDateFrom")}
                </label>
                <input
                  id="approvals-date-from"
                  type="date"
                  lang={dateLocale}
                  max={filters.dateTo || undefined}
                  className={inputToolbar}
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                />
              </div>

              <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                <label className={label} htmlFor="approvals-date-to">
                  {t("admin.attendanceDateTo")}
                </label>
                <input
                  id="approvals-date-to"
                  type="date"
                  lang={dateLocale}
                  min={filters.dateFrom || undefined}
                  className={inputToolbar}
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>

              <div className={`${searchFieldWrap} min-w-[10rem] flex-1 sm:max-w-[16rem] sm:ml-auto`}>
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder={searchPlaceholder}
                  className={inputToolbar}
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>
          </div>

          {tab === "received" && canReceive ? (
            <AdminApprovalPanel kind="all" view={receivedView} filters={filters} />
          ) : (
            <MyWorkRequestsList refreshKey={mineRefreshKey} filters={filters} />
          )}
        </div>
      )}
    </div>
  );
}
