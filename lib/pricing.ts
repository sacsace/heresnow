import type { PricingTier } from "@prisma/client";

/** 직원 수(좌석)에 맞는 첫 구간 티어 선택 — DB에서 sortOrder 기준 */
export function pickTierForSeatCount(tiers: PricingTier[], employeeCount: number): PricingTier | null {
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((t) => employeeCount >= t.minSeats && employeeCount <= t.maxSeats) ?? null;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
