export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { prisma } from "@/lib/prisma";
import { overtimeApplicationEnabled } from "@/lib/overtimePolicy";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { canReceiveWorkRequests } from "@/lib/workRequestAccess";
import { isValidWorkRequestApprover } from "@/lib/workRequestApprovers";
import {
  vacationRangeIncludesDay,
  workRequestRangesOverlap,
} from "@/lib/workRequestDates";
import { parseWorkRequestTypeParam } from "@/lib/workRequestTypes";
import { notifyApproverOfWorkRequest } from "@/lib/workRequestPush";
import { WorkRequestType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  type: z.nativeEnum(WorkRequestType),
  workDate: ymdSchema,
  workEndDate: ymdSchema.optional(),
  reason: z.string().trim().min(1).max(2000),
  extraMinutes: z.number().int().min(1).max(24 * 60).optional(),
  assignedApproverUserId: z.string().min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = parseWorkRequestTypeParam(url.searchParams.get("type"));

  const [company, employee, items] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { freePunchEnabled: true, overtimeMode: true },
    }),
    prisma.employee.findFirst({
      where: { id: session.user.employeeId, companyId: session.user.companyId },
      select: { workScheduleType: true, isTeamLeader: true },
    }),
    prisma.workRequest.findMany({
      where: {
        companyId: session.user.companyId,
        employeeId: session.user.employeeId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        assignedApprover: { select: { id: true, employee: { select: { name: true } } } },
      },
    }),
  ]);

  const freePunchEnabled =
    Boolean(company?.freePunchEnabled) && employee?.workScheduleType === "FREE";

  return NextResponse.json({
    requests: items.map((item) => ({
      ...item,
      assignedApproverName: item.assignedApprover?.employee?.name ?? null,
    })),
    policy: {
      overtimeApplicationEnabled: overtimeApplicationEnabled({
        overtimeMode: company?.overtimeMode,
        freePunchEnabled,
      }),
      canReceiveRequests: canReceiveWorkRequests(
        session.user.role,
        Boolean(employee?.isTeamLeader)
      ),
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, workDate, reason, extraMinutes, assignedApproverUserId } = parsed.data;
  let { workEndDate } = parsed.data;

  if (type === "VACATION") {
    if (!workEndDate) {
      return NextResponse.json(
        { error: "휴가 종료일을 입력해 주세요.", code: "WORK_END_DATE_REQUIRED" },
        { status: 400 }
      );
    }
    if (workEndDate < workDate) {
      return NextResponse.json(
        { error: "휴가 종료일은 시작일 이후여야 합니다.", code: "WORK_END_DATE_INVALID" },
        { status: 400 }
      );
    }
  } else {
    workEndDate = undefined;
  }

  if (type === "OVERTIME" && extraMinutes == null) {
    return NextResponse.json(
      { error: "초과 근무 예상 시간(분)을 입력해 주세요.", code: "EXTRA_MINUTES_REQUIRED" },
      { status: 400 }
    );
  }

  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { timezone: true, freePunchEnabled: true, overtimeMode: true },
    }),
    prisma.employee.findFirst({
      where: { id: session.user.employeeId, companyId: session.user.companyId },
      select: { workScheduleType: true, userId: true, name: true },
    }),
  ]);
  if (!company || !employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const freePunchEnabled =
    Boolean(company.freePunchEnabled) && employee.workScheduleType === "FREE";
  if (
    type === "OVERTIME" &&
    !overtimeApplicationEnabled({ overtimeMode: company.overtimeMode, freePunchEnabled })
  ) {
    return NextResponse.json(
      {
        error: "초과 근무는 자동 계산으로 설정되어 사전 신청할 수 없습니다.",
        code: "OVERTIME_APPLICATION_DISABLED",
      },
      { status: 403 }
    );
  }

  const approverOk = await isValidWorkRequestApprover(
    session.user.companyId,
    assignedApproverUserId,
    employee.userId
  );
  if (!approverOk) {
    return NextResponse.json(
      { error: "선택한 승인권자가 유효하지 않습니다.", code: "INVALID_APPROVER" },
      { status: 400 }
    );
  }

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const today = calendarDayInTz(new Date(), tz);
  if (workDate < today) {
    return NextResponse.json(
      { error: "과거 날짜에는 신청할 수 없습니다.", code: "WORK_DATE_PAST" },
      { status: 400 }
    );
  }

  if (
    type === "VACATION" &&
    vacationRangeIncludesDay({ workDate, workEndDate, day: today })
  ) {
    return NextResponse.json(
      {
        error: "당일 휴가는 신청할 수 없습니다. 최소 하루 전에 신청해 주세요.",
        code: "VACATION_SAME_DAY_FORBIDDEN",
      },
      { status: 400 }
    );
  }

  const existingRequests = await prisma.workRequest.findMany({
    where: {
      companyId: session.user.companyId,
      employeeId: session.user.employeeId,
      status: { not: "REJECTED" },
    },
    select: { id: true, workDate: true, workEndDate: true },
  });
  const overlapping = existingRequests.find((item) =>
    workRequestRangesOverlap({
      workDate,
      workEndDate,
      otherWorkDate: item.workDate,
      otherWorkEndDate: item.workEndDate,
    })
  );
  if (overlapping) {
    return NextResponse.json(
      {
        error: "같은 날짜에 이미 다른 근태 신청이 있습니다.",
        code: "DUPLICATE_WORK_DATE",
      },
      { status: 409 }
    );
  }

  const created = await prisma.workRequest.create({
    data: {
      companyId: session.user.companyId,
      employeeId: session.user.employeeId,
      type,
      workDate,
      workEndDate: workEndDate ?? null,
      reason: reason.trim(),
      extraMinutes: type === "OVERTIME" ? extraMinutes : null,
      assignedApproverUserId,
    },
  });

  void notifyApproverOfWorkRequest({
    approverUserId: assignedApproverUserId,
    requestId: created.id,
    employeeName: employee.name,
    type,
    workDate,
    workEndDate: workEndDate ?? null,
  }).catch((err) => {
    console.error("[work-request push]", err);
  });

  return NextResponse.json({ request: created }, { status: 201 });
}
