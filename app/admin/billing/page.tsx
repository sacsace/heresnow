"use client";

import { useI18n } from "@/components/LanguageProvider";
import { priceSuffix } from "@/lib/pricing";
import {
  bannerWarning,
  btnPrimary,
  card,
  cardBody,
  emptyState,
  errorText,
  groupedCard,
  groupedRow,
  hint,
  input,
  label,
  pageSubtitle,
  pageTitle,
  sectionLabel,
} from "@/lib/uiStyles";
import type { BillingPeriod } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  billingPeriod: BillingPeriod;
  priceAmount: number;
  currency: string;
  label: string | null;
};

type BillingState = {
  company: {
    name: string;
    seatLimit: number;
    subscriptionEndsAt: string | null;
    pricingTier: Tier | null;
  };
  employeeCount: number;
  upgradeTiers: Tier[];
  pendingRequest: { id: string; amountDue: number; targetTier: Tier; createdAt: string } | null;
};

export default function AdminBillingPage() {
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const canRequestUpgrade =
    session?.user?.role === "COMPANY_ADMIN" || session?.user?.role === "HR_MANAGER";

  const [data, setData] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  function formatTier(tier: Tier): string {
    const seats =
      tier.label ??
      t("admin.billingTierSeats")
        .replace("{min}", String(tier.minSeats))
        .replace("{max}", String(tier.maxSeats));
    return `${seats} · Rs.${tier.priceAmount}${priceSuffix(tier.billingPeriod, locale)}`;
  }

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/billing");
    const j = await r.json();
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : t("admin.billingLoadFail"));
      return;
    }
    setData(j as BillingState);
    setError(null);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestUpgrade(tierId: string) {
    if (!confirm(t("admin.billingConfirmRequest"))) return;
    setLoading(true);
    const r = await fetch("/api/admin/billing/request-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTierId: tierId, note: note.trim() || undefined }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      alert(typeof j.error === "string" ? j.error : t("admin.billingRequestFail"));
      return;
    }
    setNote("");
    await load();
    alert(t("admin.billingRequestOk"));
  }

  if (error && !data) {
    return <p className={errorText}>{error}</p>;
  }
  if (!data) {
    return <p className="text-[var(--apple-label-secondary)]">{t("common.loading")}</p>;
  }

  const { company, employeeCount, upgradeTiers, pendingRequest } = data;

  const seatsValue = t("admin.billingSeatsValue")
    .replace("{used}", String(employeeCount))
    .replace("{limit}", String(company.seatLimit));

  return (
    <div className="space-y-10 sm:space-y-12">
      <header>
        <h1 className={pageTitle}>{t("admin.billingTitle")}</h1>
        <p className={pageSubtitle}>{t("admin.billingSubtitle")}</p>
      </header>

      <section>
        <p className={sectionLabel}>{company.name}</p>
        <div className={card}>
          <dl className={`${cardBody} grid gap-4 sm:grid-cols-2`}>
            <div className="hig-divider pb-4 sm:pb-0 sm:border-b-0">
              <dt className={label}>{t("admin.billingSeatsUsage")}</dt>
              <dd className="mt-1 text-[1.0625rem] font-semibold">{seatsValue}</dd>
            </div>
            <div className="hig-divider pb-4 sm:pb-0">
              <dt className={label}>{t("admin.billingExpires")}</dt>
              <dd className="mt-1 text-[1.0625rem] font-semibold">
                {company.subscriptionEndsAt
                  ? new Date(company.subscriptionEndsAt).toLocaleDateString(dateLocale)
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2 pt-2">
              <dt className={label}>{t("admin.billingTier")}</dt>
              <dd className="mt-1 text-[0.9375rem]">
                {company.pricingTier ? formatTier(company.pricingTier) : t("admin.billingTierNone")}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {pendingRequest && (
        <section className={bannerWarning}>
          <p className="font-semibold">{t("admin.billingPendingTitle")}</p>
          <p className="mt-1">
            {t("admin.billingPendingTarget")}:{" "}
            {pendingRequest.targetTier.label ??
              t("admin.billingTierSeats")
                .replace("{min}", String(pendingRequest.targetTier.minSeats))
                .replace("{max}", String(pendingRequest.targetTier.maxSeats))}{" "}
            · Rs.{pendingRequest.amountDue} · {t("admin.billingPendingRequestedAt")}{" "}
            {new Date(pendingRequest.createdAt).toLocaleString(dateLocale)}
          </p>
        </section>
      )}

      <section>
        <p className={sectionLabel}>{t("admin.billingUpgradeTitle")}</p>
        <div className={card}>
          <div className={cardBody}>
            <p className={hint}>{t("admin.billingUpgradeLead")}</p>
            {canRequestUpgrade && (
              <div className="mt-4 hig-divider pt-4">
                <label className={label}>{t("admin.billingNoteLabel")}</label>
                <input
                  className={`${input} mt-1.5 max-w-md`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("admin.billingNotePlaceholder")}
                />
              </div>
            )}
            {!canRequestUpgrade && (
              <p className={`mt-3 ${hint}`}>{t("admin.billingPermissionNote")}</p>
            )}
          </div>
          <ul className={groupedCard}>
            {upgradeTiers.length === 0 && (
              <li className={emptyState}>{t("admin.billingNoHigher")}</li>
            )}
            {upgradeTiers.map((tier, i) => (
              <li
                key={tier.id}
                className={`${groupedRow} flex flex-wrap items-center justify-between gap-2 ${
                  i < upgradeTiers.length - 1 ? "border-b border-[var(--separator)]" : ""
                }`}
              >
                <span className="text-[0.9375rem]">
                  {tier.label ??
                    t("admin.billingTierSeats")
                      .replace("{min}", String(tier.minSeats))
                      .replace("{max}", String(tier.maxSeats))}{" "}
                  —{" "}
                  <strong>
                    Rs.{tier.priceAmount}
                    {priceSuffix(tier.billingPeriod, locale)}
                  </strong>
                </span>
                {canRequestUpgrade && (
                  <button
                    type="button"
                    disabled={loading || !!pendingRequest}
                    onClick={() => void requestUpgrade(tier.id)}
                    className={`${btnPrimary} !py-1.5 text-[0.875rem]`}
                  >
                    {t("admin.billingRequestThisTier")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
