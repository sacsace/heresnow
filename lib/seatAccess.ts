import { prisma } from "@/lib/prisma";
import { bypassesSeatLimit, SEAT_EXEMPT_ROLES } from "@/lib/seatAccessShared";
import type { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export { bypassesSeatLimit, SEAT_EXEMPT_ROLES };

/** 직원 목록·로그인 좌석 배정 기준 정렬 (이름순) */
export const EMPLOYEE_SEAT_ORDER: Prisma.EmployeeOrderByWithRelationInput[] = [
  { name: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
];

export function billableEmployeeWhere(companyId: string): Prisma.EmployeeWhereInput {
  return {
    companyId,
    user: { role: { notIn: SEAT_EXEMPT_ROLES } },
  };
}

export async function countBillableEmployees(companyId: string): Promise<number> {
  return prisma.employee.count({ where: billableEmployeeWhere(companyId) });
}

/** 이름순 상위 seatLimit명 — 관리자(HR·회사관리자)는 좌석을 차지하지 않음 */
export async function fetchSeatEligibleEmployeeIds(
  companyId: string,
  seatLimit: number
): Promise<Set<string>> {
  const limit = Math.max(0, Math.floor(seatLimit));
  if (limit <= 0) return new Set();

  const rows = await prisma.employee.findMany({
    where: { companyId },
    orderBy: EMPLOYEE_SEAT_ORDER,
    select: { id: true, user: { select: { role: true } } },
  });

  const eligible = new Set<string>();
  for (const row of rows) {
    if (bypassesSeatLimit(row.user.role)) continue;
    eligible.add(row.id);
    if (eligible.size >= limit) break;
  }
  return eligible;
}

export async function isEmployeeSeatLoginEligible(
  companyId: string,
  employeeId: string,
  seatLimit?: number
): Promise<boolean> {
  let limit = seatLimit;
  if (limit === undefined) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { seatLimit: true },
    });
    if (!company) return false;
    limit = company.seatLimit;
  }

  const eligible = await fetchSeatEligibleEmployeeIds(companyId, limit);
  return eligible.has(employeeId);
}

export async function isUserSeatLoginAllowed(input: {
  role: Role | string;
  companyId: string | null | undefined;
  employeeId: string | null | undefined;
}): Promise<boolean> {
  if (bypassesSeatLimit(input.role)) return true;
  if (!input.companyId || !input.employeeId) return true;
  return isEmployeeSeatLoginEligible(input.companyId, input.employeeId);
}

export function annotateEmployeesWithLoginAccess<
  T extends { id: string; user: { role: string } },
>(
  employees: T[],
  seatLimit: number
): (T & { loginEligible: boolean; loginEligibleByAdmin: boolean; seatRank: number })[] {
  const limit = Math.max(0, Math.floor(seatLimit));
  const billable = employees.filter((e) => !bypassesSeatLimit(e.user.role));
  const eligibleIds = new Set(billable.slice(0, limit).map((e) => e.id));

  return employees.map((employee, index) => {
    const loginEligibleByAdmin = bypassesSeatLimit(employee.user.role);
    const inSeatRange = eligibleIds.has(employee.id);
    return {
      ...employee,
      seatRank: index + 1,
      loginEligibleByAdmin,
      loginEligible: loginEligibleByAdmin || inSeatRange,
    };
  });
}
