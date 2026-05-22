import { auth } from "@/auth";
import { aggregateAttendanceByDay } from "@/lib/adminAttendanceByDay";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  let companyId = session.user.companyId;
  if (role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (!q) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    companyId = q;
  }
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "200") || 200, 500);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || "Asia/Seoul";

  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId,
      ...(employeeId ? { employeeId } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 5000,
    include: {
      employee: { select: { name: true } },
      site: { select: { name: true } },
    },
  });

  const days = aggregateAttendanceByDay(records, tz, status || undefined).slice(0, limit);

  return NextResponse.json({ timezone: tz, days });
}
