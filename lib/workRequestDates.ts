const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string): boolean {
  return YMD_RE.test(value);
}

/** 휴가 등 기간 신청의 표시용 날짜 (시작일 ~ 종료일) */
export function formatWorkRequestDateRange(
  workDate: string,
  workEndDate: string | null | undefined
): string {
  if (!workEndDate || workEndDate === workDate) return workDate;
  return `${workDate} ~ ${workEndDate}`;
}

/** YYYY-MM-DD에 일수 더하기 (UTC 기준 — 회사 캘린더일과 동일 포맷) */
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 신청의 실제 종료일 (단일일이면 시작일과 동일) */
export function workRequestEffectiveEnd(
  workDate: string,
  workEndDate?: string | null
): string {
  return workEndDate && workEndDate >= workDate ? workEndDate : workDate;
}

/** 두 근태 신청 기간이 겹치는지 */
export function workRequestRangesOverlap(params: {
  workDate: string;
  workEndDate?: string | null;
  otherWorkDate: string;
  otherWorkEndDate?: string | null;
}): boolean {
  const startA = params.workDate;
  const endA = workRequestEffectiveEnd(params.workDate, params.workEndDate);
  const startB = params.otherWorkDate;
  const endB = workRequestEffectiveEnd(params.otherWorkDate, params.otherWorkEndDate);
  return startA <= endB && startB <= endA;
}

/** 신청 기간에 특정 날짜가 포함되는지 */
export function vacationRangeIncludesDay(params: {
  workDate: string;
  workEndDate?: string | null;
  day: string;
}): boolean {
  const { workDate, workEndDate, day } = params;
  const end =
    workEndDate && workEndDate >= workDate ? workEndDate : workDate;
  return day >= workDate && day <= end;
}

/** 필터 기간과 신청 기간이 겹치는지 (YYYY-MM-DD) */
export function workRequestRangeOverlapsFilter(params: {
  workDate: string;
  workEndDate?: string | null;
  filterFrom: string;
  filterTo: string;
}): boolean {
  const { workDate, workEndDate, filterFrom, filterTo } = params;
  const start = workDate;
  const end =
    workEndDate && workEndDate >= workDate ? workEndDate : workDate;

  if (filterTo && start > filterTo) return false;
  if (filterFrom && end < filterFrom) return false;
  return true;
}
