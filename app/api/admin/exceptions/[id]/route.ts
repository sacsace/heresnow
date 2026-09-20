export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { notifyEmployeeOfAttendanceExceptionResult } from "@/lib/attendanceExceptionPush";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { evaluateCheckoutOvertimeFlags } from "@/lib/overtimePolicy";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

/** APPROVER / HR_MANAGER / COMPANY_ADMIN — 예외 승인·반려 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (
    role !== "COMPANY_ADMIN" &&
    role !== "HR_MANAGER" &&
    role !== "APPROVER" &&
    role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ex = await prisma.attendanceException.findUnique({
    where: { id },
    include: {
      attendance: {
        include: {
          employee: {
            select: {
              userId: true,
              workScheduleType: true,
              shiftCode: true,
              workStartTime: true,
              workEndTime: true,
              workScheduleByDay: true,
            },
          },
        },
      },
    },
  });
  if (!ex) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role !== "SUPER_ADMIN") {
    if (!session.user.companyId || ex.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
    }
  }

  if (ex.status !== "PENDING") {
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });
  }

  const approved = parsed.data.action === "approve";
  const checkout = ex.attendance;
  const isOvertimeApproval =
    approved &&
    checkout.type === "CHECK_OUT" &&
    !checkout.isEarlyLeave &&
    !checkout.isOvertime;

  await prisma.$transaction(async (tx) => {
    await tx.attendanceException.update({
      where: { id: ex.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        resolvedAt: new Date(),
      },
    });

    let overtimePatch: { isOvertime: boolean; overtimeMinutes: number } | null = null;
    if (isOvertimeApproval) {
      const company = await tx.company.findUnique({
        where: { id: ex.companyId },
        select: {
          timezone: true,
          freePunchEnabled: true,
          overtimeMode: true,
          workStartTime: true,
          workEndTime: true,
          workDays: true,
          workScheduleByDay: true,
          shiftPresets: true,
        },
      });
      const checkIn = await tx.attendanceRecord.findFirst({
        where: {
          companyId: ex.companyId,
          employeeId: checkout.employeeId,
          type: "CHECK_IN",
          timestamp: { lte: checkout.timestamp },
        },
        orderBy: { timestamp: "desc" },
      });
      if (company && checkIn) {
        const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
        const schedule = resolveEmployeeWorkSchedule(checkout.employee, company);
        const freePunchEnabled =
          Boolean(company.freePunchEnabled) &&
          checkout.employee.workScheduleType === "FREE";
        const flags = evaluateCheckoutOvertimeFlags({
          checkOutAt: checkout.timestamp,
          checkInAt: checkIn.timestamp,
          timeZone: tz,
          schedule,
          overtimeMode: company.overtimeMode,
          freePunchEnabled,
        });
        overtimePatch = {
          isOvertime: flags.isOvertime,
          overtimeMinutes: flags.overtimeMinutes,
        };
      }
    }

    await tx.attendanceRecord.update({
      where: { id: ex.attendanceId },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        ...(overtimePatch ?? {}),
      },
    });
    await tx.approvalLog.create({
      data: {
        companyId: ex.companyId,
        approverId: session.user.id,
        action: approved ? "EXCEPTION_APPROVE" : "EXCEPTION_REJECT",
        targetType: "AttendanceException",
        targetId: ex.id,
      },
    });
  });

  const isEarlyLeave = checkout.isEarlyLeave;
  const isOvertime =
    checkout.type === "CHECK_OUT" && !isEarlyLeave;

  void notifyEmployeeOfAttendanceExceptionResult({
    employeeUserId: ex.attendance.employee.userId,
    exceptionId: ex.id,
    approved,
    isEarlyLeave,
    isOvertime,
  }).catch((err) => {
    console.error("[attendance exception push]", err);
  });

  return NextResponse.json({ ok: true });
}
