import type { CompanyWorkSchedule } from "@/lib/companyWorkSchedule";
import { normalizeWorkScheduleByDay } from "@/lib/companyWorkSchedule";
import {
  departmentOverridesCompanySchedule,
  resolveDepartmentAsCompanySchedule,
  type DepartmentScheduleFields,
} from "@/lib/departmentWorkSchedule";
import {
  localizedShiftPresetLabel,
  normalizeShiftPresets,
  shiftPresetToSchedule,
  type ShiftCode,
  type ShiftLocale,
} from "@/lib/shiftPresets";
import {
  resolveSiteAsCompanySchedule,
  siteOverridesCompanySchedule,
  type SiteScheduleFields,
} from "@/lib/siteWorkSchedule";

export type WorkScheduleType = "COMPANY" | "SHIFT" | "CUSTOM" | "FREE";

export type EmployeeScheduleFields = {
  workScheduleType?: string | null;
  shiftCode?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  workScheduleByDay?: unknown;
  /** include 시 부서 근무시간 상속용 */
  department?: DepartmentScheduleFields | null;
};

export type CompanyScheduleFields = {
  workStartTime: string | null;
  workEndTime: string | null;
  workDays: string | null;
  workScheduleByDay?: unknown;
  shiftPresets?: unknown;
};

export function parseWorkScheduleType(raw: string | null | undefined): WorkScheduleType {
  if (raw === "SHIFT" || raw === "CUSTOM" || raw === "FREE") return raw;
  return "COMPANY";
}

export function isShiftCode(code: string | null | undefined): code is ShiftCode {
  return code === "A" || code === "B" || code === "C";
}

function applyInheritedBase(
  company: CompanyScheduleFields,
  department?: DepartmentScheduleFields | null,
  site?: SiteScheduleFields | null
): CompanyScheduleFields {
  let base = company;
  if (departmentOverridesCompanySchedule(department)) {
    base = { ...base, ...resolveDepartmentAsCompanySchedule(department!, company) };
  }
  if (siteOverridesCompanySchedule(site)) {
    base = { ...base, ...resolveSiteAsCompanySchedule(site!, base) };
  }
  return base;
}

/**
 * 직원·회사·부서·지점 설정을 합쳐 출퇴근 판정에 쓸 스케줄 반환.
 * 상속: Company → Department → Site (직원이 COMPANY일 때만).
 * 직원 SHIFT/CUSTOM/FREE는 최우선.
 */
export function resolveEmployeeWorkSchedule(
  employee: EmployeeScheduleFields,
  company: CompanyScheduleFields,
  site?: SiteScheduleFields | null,
  department?: DepartmentScheduleFields | null
): CompanyWorkSchedule {
  const type = parseWorkScheduleType(employee.workScheduleType);
  const dept = department ?? employee.department ?? null;
  const companyBase =
    type === "COMPANY" ? applyInheritedBase(company, dept, site) : company;
  const workDays = companyBase.workDays;

  if (type === "SHIFT" && isShiftCode(employee.shiftCode)) {
    const presets = normalizeShiftPresets(companyBase.shiftPresets);
    const preset = presets[employee.shiftCode];
    const times = shiftPresetToSchedule(preset);
    return {
      workStartTime: times.workStartTime,
      workEndTime: times.workEndTime,
      workDays,
      workScheduleByDay: undefined,
    };
  }

  if (type === "CUSTOM") {
    const byDay = normalizeWorkScheduleByDay(employee.workScheduleByDay);
    const hasByDay = Object.keys(byDay).length > 0;
    return {
      workStartTime: employee.workStartTime ?? companyBase.workStartTime,
      workEndTime: employee.workEndTime ?? companyBase.workEndTime,
      workDays,
      workScheduleByDay: hasByDay ? byDay : employee.workScheduleByDay,
    };
  }

  if (type === "FREE") {
    return {
      workStartTime: companyBase.workStartTime,
      workEndTime: companyBase.workEndTime,
      workDays,
      workScheduleByDay: companyBase.workScheduleByDay,
    };
  }

  return {
    workStartTime: companyBase.workStartTime,
    workEndTime: companyBase.workEndTime,
    workDays,
    workScheduleByDay: companyBase.workScheduleByDay,
  };
}

export type EmployeeScheduleSummary = {
  workScheduleType: WorkScheduleType;
  shiftCode: ShiftCode | null;
  label: string;
};

/** UI 표시용 짧은 라벨 */
export function employeeScheduleSummary(
  employee: EmployeeScheduleFields,
  company: CompanyScheduleFields,
  locale: ShiftLocale = "ko",
  department?: DepartmentScheduleFields | null
): EmployeeScheduleSummary {
  const type = parseWorkScheduleType(employee.workScheduleType);
  const dept = department ?? employee.department ?? null;
  if (type === "COMPANY") {
    if (departmentOverridesCompanySchedule(dept)) {
      const resolved = resolveDepartmentAsCompanySchedule(dept!, company);
      const start = resolved.workStartTime ?? "09:00";
      const end = resolved.workEndTime ?? "18:00";
      return {
        workScheduleType: "COMPANY",
        shiftCode: null,
        label: locale === "en" ? `Dept ${start}–${end}` : `부서 ${start}–${end}`,
      };
    }
    return {
      workScheduleType: "COMPANY",
      shiftCode: null,
      label: locale === "en" ? "Company Default" : "회사 기본",
    };
  }
  if (type === "SHIFT" && isShiftCode(employee.shiftCode)) {
    const presets = normalizeShiftPresets(company.shiftPresets);
    const p = presets[employee.shiftCode];
    const shiftName = localizedShiftPresetLabel(employee.shiftCode, locale, p.label);
    return {
      workScheduleType: "SHIFT",
      shiftCode: employee.shiftCode,
      label: `${shiftName} (${p.workStartTime}–${p.workEndTime})`,
    };
  }
  const resolved = resolveEmployeeWorkSchedule(employee, company, null, dept);
  const start = resolved.workStartTime ?? "09:00";
  const end = resolved.workEndTime ?? "18:00";
  if (type === "FREE") {
    return {
      workScheduleType: "FREE",
      shiftCode: null,
      label: locale === "en" ? "Free check-in/out" : "자유 출퇴근",
    };
  }
  return {
    workScheduleType: "CUSTOM",
    shiftCode: null,
    label: locale === "en" ? `Custom ${start}–${end}` : `개별 ${start}–${end}`,
  };
}
