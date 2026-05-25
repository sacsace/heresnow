import type { BillingPeriod, PricingTier } from "@prisma/client";

/** 직원 수(좌석)에 맞는 첫 구간 티어 선택 — DB에서 sortOrder 기준 */
export function pickTierForSeatCount(
  tiers: PricingTier[],
  employeeCount: number,
  period?: BillingPeriod
): PricingTier | null {
  const filtered = period ? tiers.filter((t) => t.billingPeriod === period) : tiers;
  const sorted = [...filtered].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((t) => employeeCount >= t.minSeats && employeeCount <= t.maxSeats) ?? null;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 체험일 → 체험 종료일, 아니면 월/연 구독 기간 */
export function subscriptionEndsAtForTier(
  tier: Pick<PricingTier, "trialDays" | "billingPeriod">
): Date {
  const now = new Date();
  if (tier.trialDays != null && tier.trialDays > 0) {
    return addDays(now, tier.trialDays);
  }
  if (tier.billingPeriod === "MONTHLY") {
    return addMonths(now, 1);
  }
  return addYears(now, 1);
}

export function billingPeriodLabel(period: BillingPeriod, locale: "ko" | "en" = "ko"): string {
  if (period === "MONTHLY") return locale === "en" ? "Monthly" : "월";
  return locale === "en" ? "Yearly" : "연";
}

export function priceSuffix(period: BillingPeriod, locale: "ko" | "en" = "ko"): string {
  if (period === "MONTHLY") return locale === "en" ? "/mo" : "/월";
  return locale === "en" ? "/yr" : "/년";
}

export function formatTierPrice(
  tier: Pick<PricingTier, "priceAmount" | "billingPeriod" | "currency">,
  locale: "ko" | "en" = "ko"
): string {
  return `Rs.${tier.priceAmount}${priceSuffix(tier.billingPeriod, locale)} (${tier.currency})`;
}
