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

export type TierPriceFields = Pick<
  PricingTier,
  "pricePerUser" | "priceAmount" | "maxSeats" | "billingPeriod" | "currency"
>;

export type BillingDiscountInput = {
  discountPercent?: number | null;
  discountAmount?: number | null;
};

export type UsageBillingBreakdown = {
  employeeCount: number;
  pricePerUser: number;
  /** 결제·구독 연장 개월 수 (기본 1) */
  months: number;
  /** 인원 × 단가 (1개월) */
  monthlySubtotal: number;
  subtotal: number;
  /** 회사별 할인 (%) */
  companyDiscountPercent: number;
  /** 사용 기간 할인 (%) — 3·6·12개월 */
  durationDiscountPercent: number;
  discountPercent: number;
  discountAmount: number;
  discountTotal: number;
  total: number;
  currency: string;
  billingPeriod: BillingPeriod;
};

/** 3·6·12개월 선결제 기간 할인 (%) */
export function getSubscriptionDurationDiscountPercent(months: number): number {
  switch (months) {
    case 3:
      return 10;
    case 6:
      return 15;
    case 12:
      return 25;
    default:
      return 0;
  }
}

export type UnitPriceSource = TierPriceFields;

/** 인원 × 1인당 단가 × 개월 − 할인 (요금 구간 없음) */
export function calculateHeadcountPayment(
  headcount: number,
  months: number,
  unitPrice: UnitPriceSource,
  discount?: BillingDiscountInput
): UsageBillingBreakdown | null {
  const count = Math.max(0, headcount);
  const pricePerUser = effectivePricePerUser(unitPrice);
  if (pricePerUser <= 0 || count <= 0) return null;

  const m = Math.max(1, Math.min(120, Math.round(months)));
  const monthlySubtotal = count * pricePerUser;
  const subtotal = monthlySubtotal * m;
  const companyDiscountPercent = Math.min(100, Math.max(0, discount?.discountPercent ?? 0));
  const durationDiscountPercent = getSubscriptionDurationDiscountPercent(m);
  const discountAmount = Math.max(0, discount?.discountAmount ?? 0);
  const fromCompanyPercent = Math.round((subtotal * companyDiscountPercent) / 100);
  const fromDurationPercent = Math.round((subtotal * durationDiscountPercent) / 100);
  const discountTotal = Math.min(subtotal, fromCompanyPercent + fromDurationPercent + discountAmount);
  const total = Math.max(0, subtotal - discountTotal);
  const discountPercent = Math.min(
    100,
    companyDiscountPercent + durationDiscountPercent
  );

  return {
    employeeCount: count,
    pricePerUser,
    months: m,
    monthlySubtotal,
    subtotal,
    companyDiscountPercent,
    durationDiscountPercent,
    discountPercent,
    discountAmount,
    discountTotal,
    total,
    currency: unitPrice.currency,
    billingPeriod: "MONTHLY",
  };
}

/** 티어에서 1인당 요금 (pricePerUser 우선, 없으면 구간 정액/maxSeats) */
export function effectivePricePerUser(tier: TierPriceFields): number {
  if (tier.pricePerUser > 0) return tier.pricePerUser;
  if (tier.maxSeats > 0 && tier.priceAmount > 0) {
    return Math.max(0, Math.round(tier.priceAmount / tier.maxSeats));
  }
  return Math.max(0, tier.priceAmount);
}

/** 결제용 티어 — 월 구간 우선, 없으면 동일 인원 구간(연) 사용 */
export function resolvePaymentTierForHeadcount(
  tiers: PricingTier[],
  headcount: number
): PricingTier | null {
  const monthly = pickTierForSeatCount(tiers, headcount, "MONTHLY");
  if (monthly) return monthly;
  return pickTierForSeatCount(tiers, headcount);
}

/** 사용 인원 × 1인당 요금 − 할인 (결제 주기는 항상 1개월) */
export function calculateMonthlyPaymentBill(
  tiers: PricingTier[],
  headcount: number,
  discount?: BillingDiscountInput
): { tier: PricingTier; bill: UsageBillingBreakdown } | null {
  const tier = resolvePaymentTierForHeadcount(tiers, headcount);
  if (!tier) return null;
  const bill = calculateUsageBilling(headcount, tier, discount);
  return { tier, bill: { ...bill, billingPeriod: "MONTHLY" } };
}

/** 사용 인원 × 1인당 요금 − 할인 */
export function calculateUsageBilling(
  employeeCount: number,
  tier: TierPriceFields,
  discount?: BillingDiscountInput
): UsageBillingBreakdown {
  const count = Math.max(0, employeeCount);
  const pricePerUser = effectivePricePerUser(tier);
  const subtotal = count * pricePerUser;
  const discountPercent = Math.min(100, Math.max(0, discount?.discountPercent ?? 0));
  const discountAmount = Math.max(0, discount?.discountAmount ?? 0);
  const fromPercent = Math.round((subtotal * discountPercent) / 100);
  const discountTotal = Math.min(subtotal, fromPercent + discountAmount);
  const total = Math.max(0, subtotal - discountTotal);

  return {
    employeeCount: count,
    pricePerUser,
    months: 1,
    monthlySubtotal: subtotal,
    subtotal,
    companyDiscountPercent: discountPercent,
    durationDiscountPercent: 0,
    discountPercent,
    discountAmount,
    discountTotal,
    total,
    currency: tier.currency,
    billingPeriod: tier.billingPeriod,
  };
}

export function formatPricePerUser(
  tier: TierPriceFields,
  locale: "ko" | "en" = "ko"
): string {
  const ppu = effectivePricePerUser(tier);
  const perPerson = locale === "en" ? "/user" : "/인";
  return `Rs.${ppu}${perPerson}${priceSuffix(tier.billingPeriod, locale)} (${tier.currency})`;
}

export function formatTierPrice(
  tier: TierPriceFields,
  locale: "ko" | "en" = "ko"
): string {
  return formatPricePerUser(tier, locale);
}

export function extendSubscriptionFrom(
  currentEndsAt: Date | null | undefined,
  billingPeriod: BillingPeriod
): Date {
  const now = new Date();
  const base =
    currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return billingPeriod === "MONTHLY" ? addMonths(base, 1) : addYears(base, 1);
}

export function extendSubscriptionByMonths(
  currentEndsAt: Date | null | undefined,
  months: number
): Date {
  const now = new Date();
  const base =
    currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return addMonths(base, Math.max(1, Math.round(months)));
}

export function formatUsageBillingLine(
  breakdown: UsageBillingBreakdown,
  locale: "ko" | "en" = "ko"
): string {
  const monthlySuffix = locale === "en" ? "/mo" : "/월";
  const months = breakdown.months ?? 1;
  const monthlySubtotal = breakdown.monthlySubtotal ?? breakdown.subtotal;

  const base =
    months <= 1
      ? locale === "en"
        ? `${breakdown.employeeCount} × Rs.${breakdown.pricePerUser} = Rs.${monthlySubtotal}${monthlySuffix}`
        : `${breakdown.employeeCount}명 × Rs.${breakdown.pricePerUser} = Rs.${monthlySubtotal}${monthlySuffix}`
      : locale === "en"
        ? `${breakdown.employeeCount} × Rs.${breakdown.pricePerUser} × ${months} mo = Rs.${breakdown.subtotal}`
        : `${breakdown.employeeCount}명 × Rs.${breakdown.pricePerUser} × ${months}개월 = Rs.${breakdown.subtotal}`;

  if (breakdown.discountTotal <= 0) {
    return base;
  }

  const parts: string[] = [];
  if (breakdown.durationDiscountPercent > 0) {
    parts.push(
      locale === "en"
        ? `${breakdown.durationDiscountPercent}% term discount`
        : `기간 할인 ${breakdown.durationDiscountPercent}%`
    );
  }
  if (breakdown.companyDiscountPercent > 0) {
    parts.push(
      locale === "en"
        ? `${breakdown.companyDiscountPercent}% company discount`
        : `회사 할인 ${breakdown.companyDiscountPercent}%`
    );
  }
  if (breakdown.discountAmount > 0) {
    parts.push(
      locale === "en"
        ? `Rs.${breakdown.discountAmount} off`
        : `Rs.${breakdown.discountAmount} 할인`
    );
  }
  const discountLabel =
    parts.length > 0
      ? locale === "en"
        ? ` (${parts.join(" + ")})`
        : ` (${parts.join(" + ")})`
      : "";

  return locale === "en"
    ? `${base} − Rs.${breakdown.discountTotal}${discountLabel} → Rs.${breakdown.total}`
    : `${base} − Rs.${breakdown.discountTotal}${discountLabel} → Rs.${breakdown.total}`;
}
