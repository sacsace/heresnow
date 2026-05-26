import type { Role } from "@prisma/client";

/**
 * 역할 서열(높을수록 강한 권한). 같은 단계는 동권으로 본다.
 *
 * SUPER_ADMIN(4) > COMPANY_ADMIN(3) > HR_MANAGER(2) > APPROVER(1) > EMPLOYEE(0)
 *
 * 본 모듈은 회사 컨텍스트의 역할 변경 권한 검사를 일원화하기 위한 표준이다.
 * 같은 회사 내에서, 호출자(caller)는 본인보다 *엄격히 낮은* 등급의 사용자를
 * 본인보다 *엄격히 낮은* 등급으로만 변경할 수 있다.
 * (예: HR_MANAGER 가 다른 HR_MANAGER 의 역할을 바꿀 수 없으며,
 *      COMPANY_ADMIN 등급으로 승격 시킬 수도 없다.)
 */
const ORDER: Role[] = ["EMPLOYEE", "APPROVER", "HR_MANAGER", "COMPANY_ADMIN", "SUPER_ADMIN"];

export function roleRank(role: Role | string | null | undefined): number {
  if (!role) return -1;
  const idx = ORDER.indexOf(role as Role);
  return idx < 0 ? -1 : idx;
}

/** 회사 컨텍스트(SUPER_ADMIN 미포함)에서 호출자가 역할을 편집할 수 있는가? */
export function canEditCompanyRoles(callerRole: Role | string | null | undefined): boolean {
  return callerRole === "COMPANY_ADMIN" || callerRole === "HR_MANAGER";
}

/**
 * 호출자가 대상 사용자의 역할을 newRole 로 변경할 수 있는지 검사.
 * - 호출자 등급이 대상 현재 등급보다 *엄격히* 높아야 한다.
 * - 새 역할 등급도 호출자 등급보다 *엄격히* 낮아야 한다.
 * - SUPER_ADMIN 으로의 승격은 어떤 회사 컨텍스트에서도 금지.
 */
export function canAssignRole(
  callerRole: Role | string | null | undefined,
  targetCurrentRole: Role | string | null | undefined,
  newRole: Role | string | null | undefined
): boolean {
  if (!callerRole || !newRole) return false;
  if (newRole === "SUPER_ADMIN") return false;
  if (!canEditCompanyRoles(callerRole) && callerRole !== "SUPER_ADMIN") return false;

  // SUPER_ADMIN 은 모든 회사 역할 변경 가능 (다만 SUPER_ADMIN 부여는 위에서 차단)
  if (callerRole === "SUPER_ADMIN") return true;

  const caller = roleRank(callerRole);
  const target = roleRank(targetCurrentRole);
  const next = roleRank(newRole);
  if (caller < 0 || target < 0 || next < 0) return false;

  return target < caller && next < caller;
}

/** 회사 컨텍스트에서 호출자가 새 사용자에게 부여할 수 있는 역할 목록 */
export function assignableRolesForCaller(callerRole: Role | string | null | undefined): Role[] {
  if (callerRole === "SUPER_ADMIN") {
    return ["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "EMPLOYEE"];
  }
  if (!canEditCompanyRoles(callerRole)) return [];
  const callerIdx = roleRank(callerRole);
  // 호출자보다 *엄격히* 낮은 등급만 (SUPER_ADMIN 은 ORDER 마지막이므로 자연 제외)
  return ORDER.slice(0, callerIdx).filter((r) => r !== "SUPER_ADMIN");
}
