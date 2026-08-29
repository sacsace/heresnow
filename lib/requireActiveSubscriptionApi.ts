import { prisma } from "@/lib/prisma";
import { isSubscriptionExpired } from "@/lib/subscriptionAccess";
import { NextResponse } from "next/server";

/**
 * 구독 만료 시 출퇴근 기록 API를 비활성화한다.
 */
export async function subscriptionPunchForbiddenResponse(
  companyId: string | null | undefined
): Promise<NextResponse | null> {
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionEndsAt: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isSubscriptionExpired(company.subscriptionEndsAt)) {
    return NextResponse.json(
      {
        error: "SUBSCRIPTION_EXPIRED",
        code: "SUBSCRIPTION_EXPIRED",
        message: "회사 구독이 만료되어 출퇴근 기능이 비활성화되었습니다. 관리자에게 문의해 주세요.",
      },
      { status: 403 }
    );
  }

  return null;
}
