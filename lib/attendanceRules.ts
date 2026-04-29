/** 회사 타임존 기준 당일 시각을 분 단위로 반환 */
export function localMinutesFromDate(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function parseHHmm(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function computeLateEarly(
  timestamp: Date,
  timeZone: string,
  type: "CHECK_IN" | "CHECK_OUT",
  expectedCheckIn: string | null | undefined,
  expectedCheckOut: string | null | undefined
): { isLate: boolean; isEarlyLeave: boolean } {
  const nowMin = localMinutesFromDate(timestamp, timeZone);
  const inMin = parseHHmm(expectedCheckIn);
  const outMin = parseHHmm(expectedCheckOut);

  if (type === "CHECK_IN") {
    if (inMin == null) return { isLate: false, isEarlyLeave: false };
    return { isLate: nowMin > inMin, isEarlyLeave: false };
  }

  if (outMin == null) return { isLate: false, isEarlyLeave: false };
  return { isLate: false, isEarlyLeave: nowMin < outMin };
}
