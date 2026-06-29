import type { Role } from "@prisma/client";

/** 구독 만료와 무관하게 앱(관리자·결제) 접근 가능 */
export function bypassesSubscriptionGate(role: Role | string | null | undefined): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "COMPANY_ADMIN" ||
    role === "HR_MANAGER" ||
    role === "DOOR"
  );
}

export function isSubscriptionExpired(subscriptionEndsAt: Date | null | undefined): boolean {
  if (!subscriptionEndsAt) return false;
  return subscriptionEndsAt.getTime() < Date.now();
}
