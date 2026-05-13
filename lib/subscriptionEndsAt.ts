import { formatInTimeZone, toDate } from "date-fns-tz";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isSubscriptionDateOnly(value: string): boolean {
  return DATE_ONLY.test(value.trim());
}

/** 달력일 `YYYY-MM-DD`의 마지막 시각(해당 TZ 23:59:59.999)을 UTC Date로 변환 */
export function dateOnlyToSubscriptionEndsAt(dateStr: string, timeZone: string): Date {
  const s = dateStr.trim();
  if (!isSubscriptionDateOnly(s)) {
    throw new RangeError("subscription date must be YYYY-MM-DD");
  }
  const tz = timeZone.trim() || "UTC";
  const d = toDate(`${s} 23:59:59.999`, { timeZone: tz });
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("invalid subscription date");
  }
  return d;
}

export function subscriptionEndsAtToDateInput(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = timeZone.trim() || "UTC";
  try {
    return formatInTimeZone(d, tz, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(d, "UTC", "yyyy-MM-dd");
  }
}
