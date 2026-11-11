export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { DOOR_PUNCHABLE_ROLES } from "@/lib/doorAttendance";
import { findPendingEarlyCheckIn } from "@/lib/earlyCheckInRequest";
import { prisma } from "@/lib/prisma";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { isValidWorkRequestApprover } from "@/lib/workRequestApprovers";
import { workRequestRangesOverlap } from "@/lib/workRequestDates";
import { notifyApproverOfWorkRequest } from "@/lib/workRequestPush";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  employeeId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
  assignedApproverUserId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  const denied = doorApiForbidden(session);
  if (denied) return denied;
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;

  const companyId = session!.user!.companyId!;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { employeeId, reason, assignedApproverUserId } = parsed.data;

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

  const approverOk = await isValidWorkRequestApprover(
    companyId,
    assignedApproverUserId,
    employee.userId
  );
  if (!approverOk) {
    return NextResponse.json(
      { error: "invalid_approver", code: "INVALID_APPROVER" },
      { status: 400 }
    );
  }

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const workDate = calendarDayInTz(new Date(), tz);

  const pending = await findPendingEarlyCheckIn({ companyId, employeeId, workDate });
  if (pending) {
    return NextResponse.json(
      { error: "already_pending", code: "EARLY_CHECK_IN_PENDING" },
      { status: 409 }
    );
  }

  const existingRequests = await prisma.workRequest.findMany({
    where: {
      companyId,
      employeeId,
      status: { not: "REJECTED" },
    },
    select: { id: true, workDate: true, workEndDate: true },
  });
  const overlapping = existingRequests.find((item) =>
    workRequestRangesOverlap({
      workDate,
      workEndDate: undefined,
      otherWorkDate: item.workDate,
      otherWorkEndDate: item.workEndDate,
    })
  );
  if (overlapping) {
    return NextResponse.json(
      { error: "duplicate_work_date", code: "DUPLICATE_WORK_DATE" },
      { status: 409 }
    );
  }

  const created = await prisma.workRequest.create({
    data: {
      companyId,
      employeeId,
      type: "EARLY_CHECK_IN",
      workDate,
      reason: reason.trim(),
      assignedApproverUserId,
    },
  });

  void notifyApproverOfWorkRequest({
    approverUserId: assignedApproverUserId,
    requestId: created.id,
    employeeName: employee.name,
    type: "EARLY_CHECK_IN",
    workDate,
    workEndDate: null,
  }).catch((err) => {
    console.error("[door early-check-in push]", err);
  });

  return NextResponse.json(
    {
      ok: true,
      request: {
        id: created.id,
        type: created.type,
        workDate: created.workDate,
        status: created.status,
      },
    },
    { status: 201 }
  );
}
