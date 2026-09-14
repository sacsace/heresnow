export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { prisma } from "@/lib/prisma";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { listWorkRequestApproverOptions } from "@/lib/workRequestApprovers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [approvers, company] = await Promise.all([
    listWorkRequestApproverOptions(session.user.companyId, session.user.id),
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { timezone: true },
    }),
  ]);

  const tz = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const todayWorkDate = calendarDayInTz(new Date(), tz);

  return NextResponse.json({ approvers, todayWorkDate });
}
