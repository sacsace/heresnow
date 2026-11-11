export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { DOOR_PUNCHABLE_ROLES } from "@/lib/doorAttendance";
import { prisma } from "@/lib/prisma";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { listWorkRequestApproverOptions } from "@/lib/workRequestApprovers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const denied = doorApiForbidden(session);
  if (denied) return denied;
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;

  const companyId = session!.user!.companyId!;
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }

  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    }),
    prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        faceEnrolledAt: { not: null },
        user: { role: { in: DOOR_PUNCHABLE_ROLES } },
      },
      select: { id: true, name: true, userId: true },
    }),
  ]);

  if (!company || !employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const todayWorkDate = calendarDayInTz(new Date(), tz);
  const approvers = await listWorkRequestApproverOptions(companyId, employee.userId);

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name },
    approvers,
    todayWorkDate,
  });
}
