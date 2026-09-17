export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { canReceiveWorkRequests } from "@/lib/workRequestAccess";
import { NextResponse } from "next/server";

/** 받은 결재 — 승인 대기 건수 (네비 배지용) */
export async function GET() {
  const session = await auth();
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeMeta = session.user.employeeId
    ? await prisma.employee.findFirst({
        where: { id: session.user.employeeId, companyId: session.user.companyId },
        select: { isTeamLeader: true },
      })
    : null;

  const isTeamLeader = Boolean(employeeMeta?.isTeamLeader);
  if (!canReceiveWorkRequests(session.user.role, isTeamLeader)) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.workRequest.count({
    where: {
      companyId: session.user.companyId,
      assignedApproverUserId: session.user.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ count });
}
