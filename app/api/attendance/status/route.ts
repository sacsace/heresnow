import { auth } from "@/auth";
import {
  calendarDayInTz,
  checkInErrorMessage,
  evaluatePunchEligibility,
} from "@/lib/attendancePunchRules";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { timezone: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || "Asia/Seoul";
  const now = new Date();

  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: session.user.employeeId,
      companyId: session.user.companyId,
    },
    orderBy: { timestamp: "desc" },
    select: { type: true, timestamp: true },
  });

  const eligibility = evaluatePunchEligibility(
    now,
    tz,
    lastRecord ? { type: lastRecord.type, timestamp: lastRecord.timestamp } : null
  );

  return NextResponse.json({
    ...eligibility,
    checkInMessage: checkInErrorMessage(eligibility.checkInBlock),
    lastType: lastRecord?.type ?? null,
    lastTimestamp: lastRecord?.timestamp.toISOString() ?? null,
    today: calendarDayInTz(now, tz),
  });
}
