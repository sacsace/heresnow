"use client";

import { AdminApprovalPanel } from "@/components/admin/AdminApprovalPanel";
import { MyWorkRequestsList } from "@/components/approvals/MyWorkRequestsList";
import { WorkRequestApplyForm } from "@/components/approvals/WorkRequestApplyForm";
import {
  defaultWorkRequestListFilters,
  hasWorkRequestListFilters,
  type WorkRequestListFilters,
} from "@/components/approvals/workRequestFilters";
import { useI18n } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { WORK_REQUEST_TYPES, workRequestTypeLabel } from "@/lib/workRequestTypes";
import {
  btnPrimary,
  btnSecondary,
  cardBody,
  groupedCard,
  inputCompact,
  label,
  pageStack,
  searchActions,
  searchFieldCol,
  searchFiltersRow,
  sectionLabel,
  segmentedBtn,
  segmentedWrap,
  selectSm,
  tableToolbar,
  tableWrap,
} from "@/lib/uiStyles";
import type { WorkRequestTypeFilter } from "@/components/approvals/workRequestFilters";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "mine" | "received";

type Props = {
  /** AdminChrome(MVS)에서 제목·부제를 이미 표시할 때 중복 헤더 숨김 */
  hidePageLead?: boolean;
};

export function AttendanceRequestsPage({ hidePageLead = false }: Props) {
  const { t, locale } = useI18n();
  const [canReceive, setCanReceive] = useState(false);
  const [tab, setTab] = useState<Tab>("mine");
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
  }, [tab]);

  const scopeTabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string }> = [
      { id: "mine", label: t("approvals.tabSubmitted") },
    ];
    if (canReceive) {
      list.push({ id: "received", label: t("approvals.tabReceived") });
    }
    return list;
  }, [canReceive, t]);

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const showReset = hasWorkRequestListFilters(filters);
  const searchInputId = hidePageLead ? "approvals-search-admin" : "approvals-search-employee";

  const typeOptions = useMemo(
    (): Array<{ id: WorkRequestTypeFilter; label: string }> => [
      { id: "all", label: t("approvals.filterTypeAll") },
      ...WORK_REQUEST_TYPES.map((type) => ({
        id: type,
        label: workRequestTypeLabel(type, t),
      })),
    ],
    [t]
  );

  const applyButton = (
    <button type="button" className={btnPrimary} onClick={() => setApplying(true)}>
      {t("approvals.applyButton")}
    </button>
  );

  return (
    <div className={`${pageStack} w-full min-w-0`}>
      {!hidePageLead ? (
        <PageHeader title={t("approvals.navTitle")} subtitle={t("approvals.navLead")} />
      ) : null}

      {applying ? (
        <section>
          <p className={sectionLabel}>{t("approvals.applySectionTitle")}</p>
          <div className={groupedCard}>
            <div className={cardBody}>
              <WorkRequestApplyForm
                embedded
                overtimeApplicationEnabled={overtimeApplicationEnabled}
                onSubmitted={() => {
                  setMineRefreshKey((k) => k + 1);
                  setApplying(false);
                  setTab("mine");
                }}
                onCancel={() => setApplying(false)}
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <div
            className={`max-w-full overflow-x-auto ${segmentedWrap}`}
            role="tablist"
            aria-label={t("approvals.tabListLabel")}
          >
            {scopeTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={segmentedBtn(tab === item.id)}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={tableWrap}>
            <div className={tableToolbar}>
              <div className="flex flex-col-reverse gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className={`${searchFiltersRow} min-w-0 flex-1`}>
                <div className={`${searchFieldCol} w-full sm:w-[9.5rem]`}>
                  <label className={label} htmlFor={`${searchInputId}-type`}>
                    {t("approvals.workRequestTypeLabel")}
                  </label>
                  <select
                    id={`${searchInputId}-type`}
                    className={`${selectSm} !h-9 !min-h-[2.25rem] !w-full !py-0`}
                    value={filters.typeFilter}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        typeFilter: e.target.value as WorkRequestTypeFilter,
                      }))
                    }
                  >
                    {typeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`${searchFieldCol} w-full sm:flex-1 sm:min-w-[12rem] sm:max-w-[18rem]`}>
                  <label className={label} htmlFor={searchInputId}>
                    {t("approvals.searchLabel")}
                  </label>
                  <input
                    id={searchInputId}
                    type="search"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder={t("approvals.searchPlaceholder")}
                    className={inputCompact}
                    aria-label={t("approvals.searchPlaceholder")}
                  />
                </div>
                <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                  <label className={label} htmlFor={`${searchInputId}-from`}>
                    {t("admin.attendanceDateFrom")}
                  </label>
                  <input
                    id={`${searchInputId}-from`}
                    type="date"
                    lang={dateLocale}
                    max={filters.dateTo || undefined}
                    className={inputCompact}
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>
                <div className={`${searchFieldCol} w-[calc(50%-0.375rem)] sm:w-[8.75rem]`}>
                  <label className={label} htmlFor={`${searchInputId}-to`}>
                    {t("admin.attendanceDateTo")}
                  </label>
                  <input
                    id={`${searchInputId}-to`}
                    type="date"
                    lang={dateLocale}
                    min={filters.dateFrom || undefined}
                    className={inputCompact}
                    value={filters.dateTo}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>
                {showReset ? (
                  <div className={searchActions}>
                    <button
                      type="button"
                      className={`${btnSecondary} h-9`}
                      onClick={() => setFilters(defaultWorkRequestListFilters())}
                    >
                      {t("admin.attendanceSearchReset")}
                    </button>
                  </div>
                ) : null}
                </div>
                <div className="flex shrink-0 justify-end lg:pl-4">
                  {applyButton}
                </div>
              </div>
            </div>

            {tab === "received" && canReceive ? (
              <AdminApprovalPanel kind="all" filters={filters} />
            ) : (
              <MyWorkRequestsList refreshKey={mineRefreshKey} filters={filters} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
