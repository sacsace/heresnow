import {
  evaluateCheckOutWorkFlags,
  scheduledShiftEndAt,
  type AttendanceWorkFlags,
  type CompanyWorkSchedule,
} from "@/lib/companyWorkSchedule";

export type OvertimeModeValue = "AUTO" | "AFTER_APPROVAL";

/** 승인 후 계산 모드 — 정규 퇴근 시각 이후 유예(분) */
export const OVERTIME_APPROVAL_GRACE_MINUTES = 60;
export const OVERTIME_APPROVAL_GRACE_MS = OVERTIME_APPROVAL_GRACE_MINUTES * 60_000;

export function normalizeOvertimeMode(value: string | null | undefined): OvertimeModeValue {
  return value === "AFTER_APPROVAL" ? "AFTER_APPROVAL" : "AUTO";
}

/** 정규 근무표 퇴근 시 초과 근무 승인 절차 필요 여부 */
export function overtimeRequiresApproval(params: {
  overtimeMode: string | null | undefined;
  freePunchEnabled: boolean;
}): boolean {
  if (params.freePunchEnabled) return false;
  return normalizeOvertimeMode(params.overtimeMode) === "AFTER_APPROVAL";
}

/** 사전 초과 근무 신청(근태 신청) 가능 여부 — 자동 계산 모드에서는 비활성 */
export function overtimeApplicationEnabled(params: {
  overtimeMode: string | null | undefined;
  freePunchEnabled: boolean;
}): boolean {
  return overtimeRequiresApproval(params);
}

type CheckoutOvertimeParams = {
  checkOutAt: Date;
  checkInAt: Date;
  timeZone: string;
  schedule: CompanyWorkSchedule;
  overtimeMode: string | null | undefined;
  freePunchEnabled: boolean;
};

/**
 * 회사 초과 근무 모드에 맞게 퇴근 OT 플래그 보정.
 * - AUTO: 정규 퇴근 시각 이후 즉시 OT 반영
 * - AFTER_APPROVAL: 퇴근 시각 + 60분까지는 OT 없이 자동 퇴근, 이후부터 OT(승인 대상)
 */
export function adjustCheckoutOvertimeForMode(
  flags: AttendanceWorkFlags,
  params: CheckoutOvertimeParams
): AttendanceWorkFlags {
  if (params.freePunchEnabled) return flags;

  const mode = normalizeOvertimeMode(params.overtimeMode);
  if (mode === "AUTO") return flags;

  const shiftEnd = scheduledShiftEndAt(params.checkInAt, params.timeZone, params.schedule);
  if (!shiftEnd) {
    return { ...flags, isOvertime: false, overtimeMinutes: 0 };
  }

  const graceEndMs = shiftEnd.getTime() + OVERTIME_APPROVAL_GRACE_MS;
  const outMs = params.checkOutAt.getTime();

  if (outMs <= graceEndMs) {
    return { ...flags, isOvertime: false, overtimeMinutes: 0 };
  }

  return {
    ...flags,
    isOvertime: true,
    overtimeMinutes: Math.round((outMs - graceEndMs) / 60_000),
  };
}

export function evaluateCheckoutOvertimeFlags(params: CheckoutOvertimeParams): AttendanceWorkFlags {
  const base = evaluateCheckOutWorkFlags(
    params.checkOutAt,
    params.checkInAt,
    params.timeZone,
    params.schedule
  );
  return adjustCheckoutOvertimeForMode(base, params);
}

/** 지금 퇴근하면 초과 근무 승인(사유 입력)이 필요한지 */
export function isCheckOutOvertimeApprovalRequired(
  checkOutAt: Date,
  checkInAt: Date,
  timeZone: string,
  schedule: CompanyWorkSchedule,
  overtimeMode: string | null | undefined,
  freePunchEnabled: boolean
): boolean {
  if (!overtimeRequiresApproval({ overtimeMode, freePunchEnabled })) return false;
  return evaluateCheckoutOvertimeFlags({
    checkOutAt,
    checkInAt,
    timeZone,
    schedule,
    overtimeMode,
    freePunchEnabled,
  }).isOvertime;
}
