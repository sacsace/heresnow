import type { WorkRequestType } from "@prisma/client";

/** 사전 근태 신청 유형 (표시·필터 순서) */
export const WORK_REQUEST_TYPES: WorkRequestType[] = [
  "OVERTIME",
  "EARLY_LEAVE",
  "REMOTE_WORK",
  "VACATION",
  "HALF_DAY_LEAVE",
];

const WORK_REQUEST_TYPE_SET = new Set<string>(WORK_REQUEST_TYPES);

export function isWorkRequestType(value: string): value is WorkRequestType {
  return WORK_REQUEST_TYPE_SET.has(value);
}

export function parseWorkRequestTypeParam(
  value: string | null | undefined
): WorkRequestType | undefined {
  if (!value) return undefined;
  return isWorkRequestType(value) ? value : undefined;
}

const TYPE_I18N_KEY: Record<WorkRequestType, string> = {
  OVERTIME: "approvals.workRequestTypeOvertime",
  EARLY_LEAVE: "approvals.workRequestTypeEarlyLeave",
  REMOTE_WORK: "approvals.workRequestTypeRemoteWork",
  VACATION: "approvals.workRequestTypeVacation",
  HALF_DAY_LEAVE: "approvals.workRequestTypeHalfDayLeave",
};

export function workRequestTypeLabel(
  type: WorkRequestType,
  t: (key: string) => string
): string {
  return t(TYPE_I18N_KEY[type]);
}
