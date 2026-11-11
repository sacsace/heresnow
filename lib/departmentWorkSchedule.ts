import type { CompanyScheduleFields } from "@/lib/employeeWorkSchedule";
import { isShiftCode } from "@/lib/employeeWorkSchedule";
import { normalizeShiftPresets, shiftPresetToSchedule } from "@/lib/shiftPresets";

export type DepartmentScheduleFields = {
  workScheduleMode?: string | null;
  shiftCode?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
};

export const DEPARTMENT_SCHEDULE_SELECT = {
  workScheduleMode: true,
  shiftCode: true,
  workStartTime: true,
  workEndTime: true,
} as const;

export function departmentOverridesCompanySchedule(
  department: DepartmentScheduleFields | null | undefined
): boolean {
  if (!department) return false;
  const mode = department.workScheduleMode ?? "COMPANY";
  if (mode === "SHIFT" && isShiftCode(department.shiftCode)) return true;
  return mode === "CUSTOM";
}

/** 부서 설정을 회사 스케줄 필드 형태로 변환 */
export function resolveDepartmentAsCompanySchedule(
  department: DepartmentScheduleFields,
  company: CompanyScheduleFields
): Pick<CompanyScheduleFields, "workStartTime" | "workEndTime" | "workScheduleByDay"> {
  const mode = department.workScheduleMode ?? "COMPANY";
  if (mode === "SHIFT" && isShiftCode(department.shiftCode)) {
    const presets = normalizeShiftPresets(company.shiftPresets);
    const times = shiftPresetToSchedule(presets[department.shiftCode]);
    return {
      workStartTime: times.workStartTime,
      workEndTime: times.workEndTime,
      workScheduleByDay: undefined,
    };
  }
  if (mode === "CUSTOM") {
    return {
      workStartTime: department.workStartTime ?? company.workStartTime,
      workEndTime: department.workEndTime ?? company.workEndTime,
      workScheduleByDay: undefined,
    };
  }
  return {
    workStartTime: company.workStartTime,
    workEndTime: company.workEndTime,
    workScheduleByDay: company.workScheduleByDay,
  };
}

export function departmentScheduleSummaryLabel(
  department: DepartmentScheduleFields | null | undefined,
  company: CompanyScheduleFields,
  locale: "ko" | "en" = "ko"
): string {
  if (!departmentOverridesCompanySchedule(department)) {
    return locale === "en" ? "Company default" : "회사 기본";
  }
  const resolved = resolveDepartmentAsCompanySchedule(department!, company);
  const start = resolved.workStartTime ?? "09:00";
  const end = resolved.workEndTime ?? "18:00";
  const mode = department!.workScheduleMode ?? "COMPANY";
  if (mode === "SHIFT" && isShiftCode(department!.shiftCode)) {
    return locale === "en"
      ? `Dept shift ${department!.shiftCode} (${start}–${end})`
      : `부서 ${department!.shiftCode}교대 (${start}–${end})`;
  }
  return locale === "en" ? `Dept ${start}–${end}` : `부서 ${start}–${end}`;
}
