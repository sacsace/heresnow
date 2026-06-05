import { addMonths } from "@/lib/pricing";
import { dateOnlyToSubscriptionEndsAt } from "@/lib/subscriptionEndsAt";
import { formatInTimeZone } from "date-fns-tz";

/** 결제 개월 수만큼 구독 연장 — 회사 타임존 기준 해당일 23:59:59.999 (슈퍼관리자 UI와 동일). */
export function extendSubscriptionByMonthsForCompany(
  currentEndsAt: Date | null | undefined,
  months: number,
  timeZone: string
): Date {
  const now = new Date();
  const base =
    currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  const extended = addMonths(base, Math.max(1, Math.round(months)));
  const tz = timeZone.trim() || "Asia/Kolkata";
  const dateStr = formatInTimeZone(extended, tz, "yyyy-MM-dd");
  return dateOnlyToSubscriptionEndsAt(dateStr, tz);
}

export type SubscriptionPaymentApplyInput = {
  subscriptionEndsAt: Date | null;
  seatLimit: number;
  timezone: string;
  /** 결제 주문에 기록된 인원(좌석) 수 */
  employeeCount: number;
  usageMonths: number;
};

export type SubscriptionPaymentApplyResult = {
  subscriptionEndsAt: Date;
  seatLimit: number;
};

/** Razorpay 결제 완료 시 회사 구독·좌석 상한 반영 */
export function computeCompanySubscriptionAfterPayment(
  input: SubscriptionPaymentApplyInput
): SubscriptionPaymentApplyResult {
  return {
    subscriptionEndsAt: extendSubscriptionByMonthsForCompany(
      input.subscriptionEndsAt,
      input.usageMonths,
      input.timezone
    ),
    seatLimit: Math.max(1, input.employeeCount),
  };
}
