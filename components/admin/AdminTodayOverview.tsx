"use client";

import { useI18n } from "@/components/LanguageProvider";
import { link, pageSubtitle, sectionLabel, statCard, statGrid, statLabel, statValue } from "@/lib/uiStyles";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TodayStats = {
  date: string;
  checkedIn: number;
  checkedOut: number;
  completePairs: number;
  employeeCount: number;
  businessTrips: number;
  lateCount: number;
  pendingExceptions: number;
};

type Props = {
  /** SUPER_ADMIN이 다른 회사의 대시보드를 볼 때만 지정. 미지정 시 세션 회사 사용. */
  companyId?: string;
  /** 우측 상단 "전체 보기" 링크를 숨기고 싶을 때 (super 컨텍스트 등) */
  hideViewAllLink?: boolean;
};

export function AdminTodayOverview({ companyId, hideViewAllLink }: Props = {}) {
  const { t } = useI18n();
  const [stats, setStats] = useState<TodayStats | null>(null);

  const load = useCallback(async () => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    const r = await fetch(`/api/admin/dashboard/today${qs}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setStats(j as TodayStats);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!stats) return null;

  const tiles = [
    { label: t("admin.todayCheckedIn"), value: stats.checkedIn, sub: `/ ${stats.employeeCount}` },
    { label: t("admin.todayComplete"), value: stats.completePairs, sub: "" },
    { label: t("admin.todayLate"), value: stats.lateCount, sub: "" },
    { label: t("admin.todayPending"), value: stats.pendingExceptions, sub: "" },
  ];

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className={sectionLabel}>{t("admin.todayTitle")}</p>
          <p className={pageSubtitle}>
            {stats.date} · {t("admin.todayLead")}
          </p>
        </div>
        {!hideViewAllLink && (
          <Link href="/admin/attendance" className={`${link} text-[0.875rem]`}>
            {t("admin.todayViewAll")} →
          </Link>
        )}
      </div>
      <div className={statGrid}>
        {tiles.map((tile) => (
          <div key={tile.label} className={statCard}>
            <p className={statValue}>
              {tile.value}
              {tile.sub && (
                <span className="text-[0.875rem] font-semibold text-[var(--apple-label-tertiary)]">
                  {tile.sub}
                </span>
              )}
            </p>
            <p className={statLabel}>{tile.label}</p>
          </div>
        ))}
      </div>
      {stats.businessTrips > 0 && (
        <p className="mt-2 px-1 text-[0.8125rem] text-[var(--apple-label-secondary)]">
          {t("admin.todayBusinessTrips").replace("{n}", String(stats.businessTrips))}
        </p>
      )}
    </section>
  );
}
