export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDoorPunchEligibility } from "@/lib/doorAttendance";
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

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, name: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const eligibility = await getDoorPunchEligibility(companyId, employeeId);
  return NextResponse.json({ employee, ...eligibility });
}
