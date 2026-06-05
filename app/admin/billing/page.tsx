"use client";

import {
  BillingProfileForm,
  type BillingProfileState,
} from "@/components/billing/BillingProfileForm";
import { PaymentHistorySection } from "@/components/billing/PaymentHistorySection";
import { RazorpayPayButton } from "@/components/billing/RazorpayPayButton";
import { useI18n } from "@/components/LanguageProvider";
import { calculateGstBreakdown, formatGstSummaryLines } from "@/lib/gst";
import {
  calculateHeadcountPayment,
  effectivePricePerUser,
  formatUsageBillingLine,
  getSubscriptionDurationDiscountPercent,
  type UsageBillingBreakdown,
} from "@/lib/pricing";
import {
  card,
  cardBody,
  errorText,
  hint,
  input,
  label,
  pageSubtitle,
  pageTitle,
  sectionLabel,
} from "@/lib/uiStyles";
import type { PricingTier } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type BillingState = {
  company: {
    name: string;
    seatLimit: number;
    subscriptionEndsAt: string | null;
    billingDiscountPercent: number;
    billingDiscountAmount: number;
    pricingTier: PricingTier | null;
  };
  registeredCount: number;
  billableEmployeeCount: number;
  defaultHeadcount: number;
  defaultMonths: number;
  razorpayConfigured: boolean;
  billingProfile: BillingProfileState;
};

const MONTH_PRESET_VALUES = [1, 3, 6, 12] as const;

const MONTH_PRESETS = MONTH_PRESET_VALUES.map((m) => ({
  months: m,
  discount: getSubscriptionDurationDiscountPercent(m),
}));

export default function AdminBillingPage() {
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const canPay =
    session?.user?.role === "COMPANY_ADMIN" || session?.user?.role === "HR_MANAGER";

  const [data, setData] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headcountInput, setHeadcountInput] = useState("");
  const [monthsInput, setMonthsInput] = useState("1");
  const [historyKey, setHistoryKey] = useState(0);
  const [billingProfile, setBillingProfile] = useState<BillingProfileState | null>(null);

  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/billing");
    const j = await r.json();
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : t("admin.billingLoadFail"));
      return;
    }
    const next = j as BillingState;
    setData(next);
    setBillingProfile(next.billingProfile);
    setHeadcountInput(String(next.defaultHeadcount));
    setMonthsInput(String(next.defaultMonths ?? 1));
    setError(null);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const headcount = useMemo(() => {
    const n = parseInt(headcountInput, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [headcountInput]);

  const months = useMemo(() => {
    const n = parseInt(monthsInput, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(120, n) : 0;
  }, [monthsInput]);

  const unitPrice = data?.company.pricingTier ?? null;

  const bill = useMemo((): UsageBillingBreakdown | null => {
    if (!data || !unitPrice || headcount <= 0 || months <= 0) return null;
    return calculateHeadcountPayment(headcount, months, unitPrice, {
      discountPercent: data.company.billingDiscountPercent,
      discountAmount: data.company.billingDiscountAmount,
    });
  }, [data, headcount, months, unitPrice]);

  const gst = useMemo(() => {
    if (!bill || !billingProfile?.state) return null;
    return calculateGstBreakdown(bill.total, billingProfile.state);
  }, [bill, billingProfile?.state]);

  if (error && !data) {
    return <p className={errorText}>{error}</p>;
  }
  if (!data) {
    return <p className="text-[var(--apple-label-secondary)]">{t("common.loading")}</p>;
  }

  const { company, registeredCount, billableEmployeeCount, razorpayConfigured } = data;
  const durationDiscountPercent = getSubscriptionDurationDiscountPercent(months);
  const hasCompanyDiscount =
    company.billingDiscountPercent > 0 || company.billingDiscountAmount > 0;
  const pricePerUser = unitPrice ? effectivePricePerUser(unitPrice) : 0;

  return (
    <div className="space-y-10 sm:space-y-12">
      <header>
        <h1 className={pageTitle}>{t("admin.billingTitle")}</h1>
        <p className={pageSubtitle}>{t("admin.billingSubtitle")}</p>
      </header>

      <BillingProfileForm
        canEdit={canPay}
        initial={billingProfile}
        onSaved={(p) => setBillingProfile(p)}
      />

      <section>
        <p className={sectionLabel}>{company.name}</p>
        <div className={card}>
          <div className={`${cardBody} space-y-6`}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className={label}>{t("admin.billingRegisteredCount")}</dt>
                <dd className="mt-1 text-[1.0625rem] font-semibold">
                  {registeredCount}
                  {locale === "en" ? "" : "명"}
                </dd>
              </div>
              <div>
                <dt className={label}>{t("admin.billingBillableCount")}</dt>
                <dd className="mt-1 text-[1.0625rem] font-semibold">
                  {billableEmployeeCount}
                  {locale === "en" ? "" : "명"}
                </dd>
                <p className={`mt-1 ${hint}`}>{t("admin.billingAdminExcludedNote")}</p>
              </div>
              <div>
                <dt className={label}>{t("admin.billingSeatLimit")}</dt>
                <dd className="mt-1 text-[1.0625rem] font-semibold">
                  {company.seatLimit}
                  {locale === "en" ? "" : "명"}
                </dd>
              </div>
              <div>
                <dt className={label}>{t("admin.billingExpires")}</dt>
                <dd className="mt-1 text-[1.0625rem] font-semibold">
                  {company.subscriptionEndsAt
                    ? new Date(company.subscriptionEndsAt).toLocaleDateString(dateLocale)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className={label}>{t("admin.billingUnitPrice")}</dt>
                <dd className="mt-1 text-[1.0625rem] font-semibold">
                  {pricePerUser > 0 ? (
                    <>
                      Rs.{pricePerUser}
                      {locale === "en" ? "/user/mo" : "/인·월"}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {hasCompanyDiscount && (
                <div>
                  <dt className={label}>{t("admin.billingDiscount")}</dt>
                  <dd className="mt-1 text-[0.9375rem] font-medium text-[var(--apple-green-dark)]">
                    {company.billingDiscountPercent > 0 &&
                      t("admin.billingDiscountPercent").replace(
                        "{n}",
                        String(company.billingDiscountPercent)
                      )}
                    {company.billingDiscountPercent > 0 &&
                      company.billingDiscountAmount > 0 &&
                      " · "}
                    {company.billingDiscountAmount > 0 &&
                      t("admin.billingDiscountAmount").replace(
                        "{n}",
                        String(company.billingDiscountAmount)
                      )}
                  </dd>
                </div>
              )}
            </dl>

            {!unitPrice && (
              <p className="text-[0.875rem] text-[var(--apple-red)]">
                {t("admin.billingNoUnitPrice")}
              </p>
            )}

            {unitPrice && (
              <>
                <div className="grid gap-6 border-t border-[var(--separator)] pt-6 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="billing-headcount">
                      {t("admin.billingHeadcountLabel")}
                    </label>
                    <p className={`mt-1 ${hint}`}>{t("admin.billingHeadcountHint")}</p>
                    <input
                      id="billing-headcount"
                      type="number"
                      min={Math.max(0, billableEmployeeCount)}
                      step={1}
                      className={`${input} mt-3 w-full max-w-[12rem] text-[1.0625rem] font-semibold`}
                      value={headcountInput}
                      onChange={(e) => setHeadcountInput(e.target.value)}
                      disabled={!canPay}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="billing-months">
                      {t("admin.billingUsageMonthsLabel")}
                    </label>
                    <p className={`mt-1 ${hint}`}>{t("admin.billingUsageMonthsHint")}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        id="billing-months"
                        type="number"
                        min={1}
                        max={120}
                        step={1}
                        className={`${input} w-full max-w-[6rem] text-[1.0625rem] font-semibold`}
                        value={monthsInput}
                        onChange={(e) => setMonthsInput(e.target.value)}
                        disabled={!canPay}
                      />
                      <span className="text-[0.875rem] text-[var(--apple-label-secondary)]">
                        {t("admin.billingUsageMonthsUnit")}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {MONTH_PRESETS.map(({ months: m, discount }) => (
                        <button
                          key={m}
                          type="button"
                          disabled={!canPay}
                          onClick={() => setMonthsInput(String(m))}
                          className={`rounded-lg px-2.5 py-1 text-[0.8125rem] font-medium transition-colors ${
                            months === m
                              ? "bg-[var(--apple-blue)] text-white"
                              : "bg-[var(--fill-tertiary)] text-[var(--apple-label-secondary)] hover:bg-[var(--fill-secondary)]"
                          }`}
                        >
                          {m}
                          {locale === "en" ? " mo" : "개월"}
                          {discount > 0 && (
                            <span
                              className={
                                months === m
                                  ? " ml-1 opacity-90"
                                  : " ml-1 text-[0.6875rem] text-[var(--apple-green-dark)]"
                              }
                            >
                              −{discount}%
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {durationDiscountPercent > 0 && (
                      <p className="mt-2 text-[0.8125rem] font-medium text-[var(--apple-green-dark)]">
                        {t("admin.billingDurationDiscountApplied")
                          .replace("{months}", String(months))
                          .replace("{n}", String(durationDiscountPercent))}
                      </p>
                    )}
                  </div>
                </div>

                {bill ? (
                  <div className="rounded-xl bg-[var(--fill-tertiary)] px-4 py-4">
                    <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">
                      {t("admin.billingFormula")}
                    </p>
                    <p className="mt-2 text-[0.875rem] text-[var(--apple-label-secondary)]">
                      {formatUsageBillingLine(bill, locale)}
                    </p>
                    {gst && gst.gstTotal > 0 && (
                      <div className="mt-3 space-y-1 text-[0.8125rem] text-[var(--apple-label-secondary)]">
                        <p>
                          {t("admin.billingTaxableAmount")}: Rs.{gst.taxableAmount}
                        </p>
                        {formatGstSummaryLines(gst, locale).map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <p className="text-[0.75rem] text-[var(--apple-label-tertiary)]">
                          {gst.isIntraState
                            ? t("admin.billingGstIntraState")
                            : t("admin.billingGstInterState")}
                        </p>
                      </div>
                    )}
                    <p className="mt-3 text-[1.375rem] font-bold tracking-tight">
                      {t("admin.billingTotalDue")}: Rs.{gst?.grandTotal ?? bill.total}
                    </p>
                    {bill.months > 1 && (
                      <p className="mt-1 text-[0.8125rem] text-[var(--apple-label-secondary)]">
                        {t("admin.billingMonthlyEquivalent").replace(
                          "{amount}",
                          String(bill.monthlySubtotal)
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  headcount > 0 &&
                  months > 0 && (
                    <p className="text-[0.875rem] text-[var(--apple-red)]">
                      {t("admin.billingNoUnitPrice")}
                    </p>
                  )
                )}
              </>
            )}

            {canPay ? (
              razorpayConfigured ? (
                <>
                  {!billingProfile?.complete && (
                    <p className={`${hint} mb-3 text-[var(--apple-orange)]`}>
                      {t("admin.billingProfileRequiredForPay")}
                    </p>
                  )}
                  <RazorpayPayButton
                    employeeCount={headcount}
                    months={months}
                    bill={bill}
                    companyName={company.name}
                    userEmail={session?.user?.email}
                    disabled={!bill || !billingProfile?.complete}
                    onPaid={() => {
                      void load();
                      setHistoryKey((k) => k + 1);
                    }}
                  />
                </>
              ) : (
                <p className={hint}>{t("admin.billingRazorpayNotConfigured")}</p>
              )
            ) : (
              <p className={hint}>{t("admin.billingPermissionNote")}</p>
            )}
          </div>
        </div>
      </section>

      <PaymentHistorySection refreshKey={historyKey} canRetryEInvoice={canPay} />
    </div>
  );
}
