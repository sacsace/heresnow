export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { resolveDoorTerminalMode } from "@/lib/doorTerminalMode";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const denied = doorApiForbidden(session);
  if (denied) return denied;

  const companyId = session!.user!.companyId!;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      timezone: true,
      workStartTime: true,
      workEndTime: true,
      workDays: true,
      workScheduleByDay: true,
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const now = new Date();
  const modeInfo = resolveDoorTerminalMode(now, tz, company);

  return NextResponse.json({
    ...modeInfo,
    now: now.toISOString(),
  });
}
