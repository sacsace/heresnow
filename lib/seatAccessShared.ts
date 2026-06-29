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
