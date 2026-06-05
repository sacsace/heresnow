import type { Session } from "next-auth";

export function canViewBilling(session: Session | null): boolean {
  const role = session?.user?.role;
  return role === "COMPANY_ADMIN" || role === "HR_MANAGER" || role === "APPROVER";
}

export function canPayBilling(session: Session | null): boolean {
  const role = session?.user?.role;
  return role === "COMPANY_ADMIN" || role === "HR_MANAGER";
}
