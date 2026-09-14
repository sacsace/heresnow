export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDoorPunchEligibility } from "@/lib/doorAttendance";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const denied = doorApiForbidden(session);
  if (denied) return denied;

  const companyId = session!.user!.companyId!;
  const employeeId = new URL(req.url).searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
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
        shiftPresets: true,
      },
    }),
    prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        name: true,
        workScheduleType: true,
        shiftCode: true,
        workStartTime: true,
        workEndTime: true,
        workScheduleByDay: true,
      },
    }),
  ]);
  if (!company || !employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const effectiveSchedule = resolveEmployeeWorkSchedule(employee, company);
  const eligibility = await getDoorPunchEligibility(
    companyId,
    employeeId,
    effectiveSchedule
  );
  return NextResponse.json({ employee, ...eligibility });
}
