export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import {
  createDoorAttendanceRecord,
  DOOR_PUNCHABLE_ROLES,
  getDoorPunchEligibility,
  matchFaceDoorEmployee,
  parseDoorFaceDescriptor,
  FACE_DESCRIPTOR_LENGTH,
} from "@/lib/doorAttendance";
import { resolveDoorPunchTimeWindow, resolveDoorTerminalMode } from "@/lib/doorTerminalMode";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { prisma } from "@/lib/prisma";
import { AttendanceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const faceBodySchema = z.object({
  faceDescriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH),
});

export async function POST(req: Request) {
  const session = await auth();
  const denied = doorApiForbidden(session);
  if (denied) return denied;

  const companyId = session!.user!.companyId!;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = faceBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const probe = parseDoorFaceDescriptor(parsed.data.faceDescriptor);
  if (!probe) {
    return NextResponse.json({ error: "invalid_face" }, { status: 400 });
  }

  const [company, matchedEmployee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        workDays: true,
        workScheduleByDay: true,
        shiftPresets: true,
      },
    }),
    matchFaceDoorEmployee(probe, companyId),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!matchedEmployee) {
    return NextResponse.json({ error: "face_not_matched", code: "FACE_NOT_MATCHED" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const now = new Date();
  const employee = await prisma.employee.findFirst({
    where: {
      id: matchedEmployee.id,
      companyId,
      faceEnrolledAt: { not: null },
      user: { role: { in: DOOR_PUNCHABLE_ROLES } },
    },
    select: {
      id: true,
      name: true,
      workScheduleType: true,
      shiftCode: true,
      workStartTime: true,
      workEndTime: true,
      workScheduleByDay: true,
    },
  });
  if (!employee) {
    return NextResponse.json({ error: "face_not_matched", code: "FACE_NOT_MATCHED" }, { status: 404 });
  }
  const effectiveSchedule = resolveEmployeeWorkSchedule(employee, company);
  const { mode } = resolveDoorTerminalMode(now, tz, effectiveSchedule);
  const type: AttendanceType = mode;
  const timeWindow = resolveDoorPunchTimeWindow(now, tz, effectiveSchedule);

  if (type === "CHECK_IN" && now.getTime() < new Date(timeWindow.checkInOpenAt).getTime()) {
    return NextResponse.json(
      {
        error: "checkin_too_early",
        code: "CHECK_IN_TOO_EARLY",
        employee: { id: employee.id, name: employee.name },
        mode: type,
        nextCheckInAt: timeWindow.checkInOpenAt,
      },
      { status: 409 }
    );
  }
  if (type === "CHECK_OUT" && now.getTime() < new Date(timeWindow.checkOutOpenAt).getTime()) {
    return NextResponse.json(
      {
        error: "checkout_too_early",
        code: "CHECK_OUT_TOO_EARLY",
        employee: { id: employee.id, name: employee.name },
        mode: type,
        nextCheckOutAt: timeWindow.checkOutOpenAt,
      },
      { status: 409 }
    );
  }

  const eligibility = await getDoorPunchEligibility(companyId, employee.id);

  if (type === "CHECK_IN") {
    if (!eligibility.canCheckIn) {
      if (eligibility.checkInBlock === "ALREADY_CHECKED_IN") {
        return NextResponse.json(
          {
            error: "already_checked_in",
            code: "ALREADY_CHECKED_IN",
            employee: { id: employee.id, name: employee.name },
            mode: type,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "checkin_cooldown",
          code: "CHECK_IN_COOLDOWN",
          employee: { id: employee.id, name: employee.name },
          mode: type,
          nextCheckInAt: eligibility.nextCheckInAt,
        },
        { status: 409 }
      );
    }
  } else if (!eligibility.canCheckOut) {
    if (eligibility.checkOutBlock === "MIN_INTERVAL") {
      return NextResponse.json(
        {
          error: "checkout_cooldown",
          code: "CHECK_OUT_COOLDOWN",
          employee: { id: employee.id, name: employee.name },
          mode: type,
          nextCheckOutAt: eligibility.nextCheckOutAt,
        },
        { status: 409 }
      );
    }
    if (eligibility.lastType === "CHECK_OUT") {
      return NextResponse.json(
        {
          error: "already_checked_out",
          code: "ALREADY_CHECKED_OUT",
          employee: { id: employee.id, name: employee.name },
          mode: type,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: "not_checked_in",
        code: "NOT_CHECKED_IN",
        employee: { id: employee.id, name: employee.name },
        mode: type,
      },
      { status: 409 }
    );
  }

  let record;
  try {
    record = await createDoorAttendanceRecord({
      companyId,
      employeeId: employee.id,
      type,
      timestamp: now,
      expectedLastType: eligibility.lastType,
      expectedLastTimestamp: eligibility.lastTimestamp,
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "PUNCH_STATE_CHANGED") {
        return NextResponse.json(
          {
            error: "punch_state_changed",
            code,
          },
          { status: 409 }
        );
      }
      if (code === "CHECK_IN_BLOCKED") {
        return NextResponse.json(
          {
            error: "checkin_cooldown",
            code: "CHECK_IN_COOLDOWN",
            employee: { id: employee.id, name: employee.name },
            mode: type,
            nextCheckInAt: eligibility.nextCheckInAt,
          },
          { status: 409 }
        );
      }
      if (code === "CHECK_OUT_BLOCKED") {
        return NextResponse.json(
          {
            error: "checkout_cooldown",
            code: "CHECK_OUT_COOLDOWN",
            employee: { id: employee.id, name: employee.name },
            mode: type,
            nextCheckOutAt: eligibility.nextCheckOutAt,
          },
          { status: 409 }
        );
      }
    }
    throw error;
  }

  const next = await getDoorPunchEligibility(companyId, employee.id);

  return NextResponse.json({
    ok: true,
    mode: type,
    employee: { id: employee.id, name: employee.name },
    record: {
      id: record.id,
      type: record.type,
      timestamp: record.timestamp.toISOString(),
    },
    ...next,
  });
}
