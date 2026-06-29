export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import {
  createDoorAttendanceRecord,
  getDoorPunchEligibility,
  matchFaceDoorEmployee,
  parseDoorFaceDescriptor,
  FACE_DESCRIPTOR_LENGTH,
} from "@/lib/doorAttendance";
import { resolveDoorTerminalMode } from "@/lib/doorTerminalMode";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
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

  const [company, employee] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        workDays: true,
        workScheduleByDay: true,
      },
    }),
    matchFaceDoorEmployee(probe, companyId),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!employee) {
    return NextResponse.json({ error: "face_not_matched", code: "FACE_NOT_MATCHED" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const now = new Date();
  const { mode } = resolveDoorTerminalMode(now, tz, company);
  const type: AttendanceType = mode;

  const eligibility = await getDoorPunchEligibility(companyId, employee.id);

  if (type === "CHECK_IN") {
    if (!eligibility.canCheckIn) {
      return NextResponse.json(
        {
          error: "checkout_too_early",
          code: "CHECK_OUT_TOO_EARLY",
          employee,
          mode: type,
        },
        { status: 409 }
      );
    }
  } else if (!eligibility.canCheckOut) {
    if (eligibility.lastType === "CHECK_OUT") {
      return NextResponse.json(
        {
          error: "already_checked_out",
          code: "ALREADY_CHECKED_OUT",
          employee,
          mode: type,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: "not_checked_in",
        code: "NOT_CHECKED_IN",
        employee,
        mode: type,
      },
      { status: 409 }
    );
  }

  const record = await createDoorAttendanceRecord({
    companyId,
    employeeId: employee.id,
    type,
  });

  const next = await getDoorPunchEligibility(companyId, employee.id);

  return NextResponse.json({
    ok: true,
    mode: type,
    employee,
    record: {
      id: record.id,
      type: record.type,
      timestamp: record.timestamp.toISOString(),
    },
    ...next,
  });
}
