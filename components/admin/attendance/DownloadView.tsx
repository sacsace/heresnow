"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { ReactNode } from "react";
import {
  bannerInfo,
  btnPrimary,
  btnSecondary,
  groupedCard,
  hint,
} from "@/lib/uiStyles";

type Filters = {
  q: string;
  from: string;
  to: string;
  status: string;
  departmentId: string;
};

type Props = {
  exportHref: string;
  filters: Filters;
  departments: { id: string; name: string }[];
  onApplyMonthRange: () => void;
};

function CellBadge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex min-w-[1.75rem] items-center justify-center rounded px-1.5 py-0.5 text-[0.8125rem] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function RuleBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-[0.8125rem] font-semibold text-[var(--foreground)]">{title}</h4>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]">
        {body}
      </p>
    </div>
  );
}

export function AttendanceDownloadView({
  exportHref,
  filters,
  departments,
  onApplyMonthRange,
}: Props) {
  const { t } = useI18n();

  const deptName =
    filters.departmentId &&
    departments.find((d) => d.id === filters.departmentId)?.name;

  return (
    <div className={groupedCard}>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[0.9375rem] leading-relaxed text-[var(--apple-label-secondary)]">
          {t("admin.attendanceDownloadHint")}
        </p>

        <dl className="mt-4 grid gap-2 text-[0.875rem] sm:grid-cols-2">
          <div>
            <dt className="text-[var(--apple-label-tertiary)]">{t("admin.attendanceDateFrom")}</dt>
            <dd className="font-medium text-[var(--foreground)]">{filters.from || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--apple-label-tertiary)]">{t("admin.attendanceDateTo")}</dt>
            <dd className="font-medium text-[var(--foreground)]">{filters.to || "—"}</dd>
          </div>
          {filters.q ? (
            <div>
              <dt className="text-[var(--apple-label-tertiary)]">
                {t("admin.attendanceSearchName")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{filters.q}</dd>
            </div>
          ) : null}
          {deptName ? (
            <div>
              <dt className="text-[var(--apple-label-tertiary)]">
                {t("admin.attendanceFilterDepartment")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{deptName}</dd>
            </div>
          ) : null}
          {filters.status ? (
            <div>
              <dt className="text-[var(--apple-label-tertiary)]">
                {t("admin.attendanceFilterStatus")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{filters.status}</dd>
            </div>
          ) : null}
        </dl>

        <p className={`mt-4 ${hint}`}>{t("admin.attendanceDownloadApplyNote")}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={onApplyMonthRange}>
            {t("admin.attendanceDownloadThisMonth")}
          </button>
        </div>

        <div className={`mt-5 space-y-4 ${bannerInfo}`}>
          <p className="!bg-transparent !p-0 text-[0.8125rem] text-[var(--apple-label-secondary)]">
            {t("admin.attendanceDownloadFormat")}
          </p>

          <div>
            <h3 className="text-[0.875rem] font-semibold text-[var(--foreground)]">
              {t("admin.attendanceDownloadRulesTitle")}
            </h3>

            <div className="mt-3 space-y-3">
              <div>
                <h4 className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
                  {t("admin.attendanceDownloadCalendarTitle")}
                </h4>
                <ul className="mt-2 space-y-1.5 text-[0.8125rem] text-[var(--apple-label-secondary)]">
                  <li className="flex flex-wrap items-center gap-2">
                    <CellBadge className="bg-[#E8F5E9] text-[#1B5E20]">O</CellBadge>
                    <span>{t("admin.attendanceDownloadCalendarO")}</span>
                  </li>
                  <li className="flex flex-wrap items-center gap-2">
                    <CellBadge className="bg-[#FFF8E1] text-[#E65100]">△</CellBadge>
                    <span>{t("admin.attendanceDownloadCalendarLate")}</span>
                  </li>
                  <li className="flex flex-wrap items-center gap-2">
                    <CellBadge className="bg-[#E3F2FD] text-[#1565C0]">0.5</CellBadge>
                    <span>{t("admin.attendanceDownloadCalendarHalf")}</span>
                  </li>
                  <li className="flex flex-wrap items-center gap-2">
                    <CellBadge className="bg-[#FFEBEE] text-[#C62828] text-[0.75rem]">
                      —
                    </CellBadge>
                    <span>{t("admin.attendanceDownloadCalendarBlank")}</span>
                  </li>
                </ul>
              </div>

              <RuleBlock
                title={t("admin.attendanceDownloadOtTitle")}
                body={t("admin.attendanceDownloadOtBody")}
              />
              <RuleBlock
                title={t("admin.attendanceDownloadAbsentTitle")}
                body={t("admin.attendanceDownloadAbsentBody")}
              />
              <RuleBlock
                title={t("admin.attendanceDownloadWorkTitle")}
                body={t("admin.attendanceDownloadWorkBody")}
              />
              <RuleBlock
                title={t("admin.attendanceDownloadHolidayTitle")}
                body={t("admin.attendanceDownloadHolidayBody")}
              />
            </div>
          </div>
        </div>

        <a
          href={exportHref}
          className={`${btnPrimary} mt-5 inline-flex min-h-[2.75rem] items-center justify-center px-6`}
        >
          {t("admin.attendanceDownloadButton")}
        </a>
      </div>
    </div>
  );
}
