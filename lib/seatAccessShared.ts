import type { Role } from "@prisma/client";

/** 좌석·결제 대상에서 제외 — 로그인은 좌석 없이 허용 */
export const SEAT_EXEMPT_ROLES: Role[] = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "HR_MANAGER",
  "DOOR",
];

/** 좌석 제한 없이 로그인 가능한 역할 */
export function bypassesSeatLimit(role: Role | string | null | undefined): boolean {
  return SEAT_EXEMPT_ROLES.includes(role as Role);
}

/** 서버 EMPLOYEE_SEAT_ORDER 와 동일 — 이름 → 등록일 → id */
export function sortEmployeesLikeSeatOrder<
  T extends { id: string; name: string; createdAt?: Date | string | null },
>(employees: T[]): T[] {
  return [...employees].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "ko", { sensitivity: "base" });
    if (byName !== 0) return byName;
    const ta =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
    const tb =
      b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/** 직원 목록 UI — 좌석·관리자 역할 기준 로그인 가능 표시 (서버 GET / 클라이언트 PATCH 후 동일 로직) */
export function annotateEmployeesWithLoginAccess<
  T extends { id: string; name: string; user: { role: string }; createdAt?: Date | string | null },
>(
  employees: T[],
  seatLimit: number
): (T & { loginEligible: boolean; loginEligibleByAdmin: boolean; seatRank: number })[] {
  const limit = Math.max(0, Math.floor(seatLimit));
  const ordered = sortEmployeesLikeSeatOrder(employees);
  const billable = ordered.filter((e) => !bypassesSeatLimit(e.user.role));
  const eligibleIds = new Set(billable.slice(0, limit).map((e) => e.id));
  const rankById = new Map(ordered.map((e, index) => [e.id, index + 1]));

  return employees.map((employee) => {
    const loginEligibleByAdmin = bypassesSeatLimit(employee.user.role);
    const inSeatRange = eligibleIds.has(employee.id);
    return {
      ...employee,
      seatRank: rankById.get(employee.id) ?? 0,
      loginEligibleByAdmin,
      loginEligible: loginEligibleByAdmin || inSeatRange,
    };
  });
}
