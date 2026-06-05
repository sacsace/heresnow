import { auth } from "@/auth";
import { isUserSeatLoginAllowed } from "@/lib/seatAccess";
import { bypassesSubscriptionGate, isSubscriptionExpired } from "@/lib/subscriptionAccess";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/** 직원·승인자 — 구독 만료·로그인 좌석 밖이면 출퇴근 차단. 회사관리자·인사는 항상 허용 */
export async function requireActiveSubscription() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (bypassesSubscriptionGate(session.user.role)) return;

  const companyId = session.user.companyId;
  if (!companyId) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionEndsAt: true },
  });
  if (!company) redirect("/login?session=invalid");

  if (isSubscriptionExpired(company.subscriptionEndsAt)) {
    redirect("/employee/subscription-expired");
  }

  const seatAllowed = await isUserSeatLoginAllowed({
    role: session.user.role,
    companyId,
    employeeId: session.user.employeeId,
  });
  if (!seatAllowed) {
    redirect("/employee/seat-unavailable");
  }
}
