"use client";

import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SubscriptionInfo = {
  subscriptionEndsAt: string | null;
  timezone: string;
};

type Props = {
  companyId?: string;
};

function formatSubscriptionDate(
  iso: string,
  timeZone: string,
  locale: string
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "en" ? "en-IN" : "ko-KR", {
    timeZone: timeZone || "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** 대시보드 우측 상단용 간결한 구독 만료일 표시 */
export function AdminSubscriptionBanner({ companyId }: Props = {}) {
  const { t, locale } = useI18n();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);

  const load = useCallback(async () => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    const r = await fetch(`/api/admin/dashboard/today${qs}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setInfo({
      subscriptionEndsAt:
        typeof j.subscriptionEndsAt === "string" ? j.subscriptionEndsAt : null,
      timezone: typeof j.timezone === "string" ? j.timezone : "Asia/Kolkata",
    });
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!info) return null;

  const endsLabel = info.subscriptionEndsAt
    ? formatSubscriptionDate(info.subscriptionEndsAt, info.timezone, locale)
    : "—";
  const days = info.subscriptionEndsAt ? daysUntil(info.subscriptionEndsAt) : null;
  const expired = days !== null && days < 0;
  const expiringSoon = days !== null && days >= 0 && days <= 14;

  const tone = expired
    ? "text-[var(--apple-red)]"
    : expiringSoon
      ? "text-[var(--apple-orange)]"
      : "text-[var(--foreground)]";

  const body = (
    <div className="text-right">
      <p className="text-[0.6875rem] font-medium text-[var(--apple-label-secondary)]">
        {expired
          ? t("admin.dashboardSubscriptionLabelExpired")
          : t("admin.dashboardSubscriptionLabel")}
      </p>
      <p className={`mt-0.5 text-[0.875rem] font-semibold tracking-tight ${tone}`}>
        {endsLabel}
        {days !== null && !expired ? (
          <span className="ml-1.5 text-[0.75rem] font-medium text-[var(--apple-label-secondary)]">
            ({t("admin.dashboardSubscriptionDaysLeft").replace("{n}", String(days))})
          </span>
        ) : null}
      </p>
    </div>
  );

  if (companyId) {
    return <div className="shrink-0">{body}</div>;
  }

  return (
    <Link
      href="/admin/billing"
      className="shrink-0 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--apple-blue)]/30"
      title={t("admin.billingRenewTitle")}
    >
      {body}
    </Link>
  );
}
