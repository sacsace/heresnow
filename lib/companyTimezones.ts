/** HeresNow 기본 회사 타임존 — 인도 표준시 (IST) */
export const DEFAULT_COMPANY_TIMEZONE = "Asia/Kolkata" as const;

/** 회사 설정에서 선택 가능한 IANA 타임존 목록 (인도 시간이 첫 번째) */
export const COMPANY_TIMEZONE_OPTIONS = [
  DEFAULT_COMPANY_TIMEZONE,
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

export type CompanyTimezoneOption = (typeof COMPANY_TIMEZONE_OPTIONS)[number];

export function isValidIanaTimezone(tz: string): boolean {
  const trimmed = tz.trim();
  if (!trimmed || trimmed.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/** 선택 목록용 라벨 — "Asia/Seoul (GMT+9)" 형태 */
export function formatTimezoneOptionLabel(tz: string, locale = "ko-KR"): string {
  const trimmed = tz.trim();
  if (!isValidIanaTimezone(trimmed)) return trimmed;
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: trimmed,
      timeZoneName: "shortOffset",
    });
    const offset =
      formatter.formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
    const name = trimmed.replace(/_/g, " ");
    return offset ? `${name} (${offset})` : name;
  } catch {
    return trimmed.replace(/_/g, " ");
  }
}

/** 기록에 저장된 타임존 우선, 없으면 회사 현재 설정 */
export function recordDisplayTimezone(
  record: { recordTimezone?: string | null },
  companyTimezone: string
): string {
  const stored = record.recordTimezone?.trim();
  if (stored && isValidIanaTimezone(stored)) return stored;
  const company = companyTimezone.trim();
  if (company && isValidIanaTimezone(company)) return company;
  return DEFAULT_COMPANY_TIMEZONE;
}

/** ISO timestamp → 회사 타임존 기준 시각 (출퇴근 UI 표시용) */
export function formatTimeInCompanyTz(
  timestamp: string | Date,
  timeZone: string,
  locale: string
): string {
  const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const tz = timeZone.trim() || DEFAULT_COMPANY_TIMEZONE;
  try {
    return d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
  } catch {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
}

/** ISO timestamp → 회사 타임존 기준 날짜 */
export function formatDateInCompanyTz(
  timestamp: string | Date,
  timeZone: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const tz = timeZone.trim() || DEFAULT_COMPANY_TIMEZONE;
  try {
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: tz,
      ...options,
    });
  } catch {
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      ...options,
    });
  }
}

/** DB 값이 목록에 없으면 목록 맨 앞에 포함 (기존 회사 호환) */
export function timezoneOptionsForSelect(current: string | null | undefined): string[] {
  const tz = current?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const set = new Set<string>([...COMPANY_TIMEZONE_OPTIONS]);
  if (isValidIanaTimezone(tz) && !set.has(tz)) {
    return [tz, ...COMPANY_TIMEZONE_OPTIONS];
  }
  return [...COMPANY_TIMEZONE_OPTIONS];
}
