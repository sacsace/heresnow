import { auth } from "@/auth";
import { calendarDayInTz } from "@/lib/adminMonthlyAttendance";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";
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

  let companyId = session.user.companyId;
  if (role === "SUPER_ADMIN") {
    const url = new URL(req.url);
    const q = url.searchParams.get("companyId");
    if (!q) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    companyId = q;
  }
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || "Asia/Kolkata";
  const today = calendarDayInTz(new Date(), tz);
  const dayStart = fromZonedTime(`${today} 00:00:00`, tz);
  const dayEnd = fromZonedTime(`${today} 23:59:59.999`, tz);

  const [employeeCount, records, pendingExceptions] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.attendanceRecord.findMany({
      where: { companyId, timestamp: { gte: dayStart, lte: dayEnd } },
      select: {
        employeeId: true,
        type: true,
        isBusinessTrip: true,
        isLate: true,
      },
    }),
    prisma.attendanceException.count({
      where: { companyId, status: "PENDING" },
    }),
  ]);

  const checkedInEmployees = new Set<string>();
  const checkedOutEmployees = new Set<string>();
  let businessTrips = 0;
  let lateCount = 0;

  for (const r of records) {
    if (r.type === "CHECK_IN") {
      checkedInEmployees.add(r.employeeId);
      if (r.isBusinessTrip) businessTrips += 1;
      if (r.isLate) lateCount += 1;
    }
    if (r.type === "CHECK_OUT") {
      checkedOutEmployees.add(r.employeeId);
    }
  }

  const completePairs = [...checkedInEmployees].filter((id) =>
    checkedOutEmployees.has(id)
  ).length;

  return NextResponse.json({
    date: today,
    timezone: tz,
    employeeCount,
    checkedIn: checkedInEmployees.size,
    checkedOut: checkedOutEmployees.size,
    completePairs,
    businessTrips,
    lateCount,
    pendingExceptions,
  });
}
