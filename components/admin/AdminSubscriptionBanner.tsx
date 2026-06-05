"use client";

import { useI18n } from "@/components/LanguageProvider";
import { card, cardBody, hint, link } from "@/lib/uiStyles";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SubscriptionInfo = {
  subscriptionEndsAt: string | null;
  timezone: string;
  seatLimit: number;
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
      seatLimit: typeof j.seatLimit === "number" ? j.seatLimit : 0,
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

  const accent = expired
    ? "border-[var(--apple-red)]/35 bg-[var(--apple-red)]/[0.06]"
    : expiringSoon
      ? "border-[var(--apple-orange)]/35 bg-[var(--apple-orange)]/[0.06]"
      : "border-[var(--separator)] bg-[var(--grouped-bg)]";

  const valueClass = expired
    ? "text-[var(--apple-red)]"
    : expiringSoon
      ? "text-[var(--apple-orange)]"
      : "text-[var(--foreground)]";

  return (
    <div className={`${card} ${accent}`}>
      <div className={`${cardBody} flex flex-wrap items-center justify-between gap-3 py-4 sm:py-5`}>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--apple-label-secondary)]">
            {t("admin.dashboardSubscriptionLabel")}
          </p>
          <p className={`mt-1 text-[1.125rem] font-semibold tracking-tight ${valueClass}`}>
            {endsLabel}
          </p>
          {days !== null && (
            <p className={`${hint} mt-1`}>
              {expired
                ? t("admin.dashboardSubscriptionExpired")
                : t("admin.dashboardSubscriptionDaysLeft").replace("{n}", String(days))}
              {info.seatLimit > 0 &&
                ` · ${t("admin.dashboardSubscriptionSeats").replace("{n}", String(info.seatLimit))}`}
            </p>
          )}
          {days === null && info.seatLimit > 0 && (
            <p className={`${hint} mt-1`}>
              {t("admin.dashboardSubscriptionSeats").replace("{n}", String(info.seatLimit))}
            </p>
          )}
        </div>
        {!companyId && (
          <Link href="/admin/billing" className={`${link} shrink-0 text-[0.875rem] font-medium`}>
            {t("admin.billingRenewTitle")} →
          </Link>
        )}
      </div>
    </div>
  );
}
