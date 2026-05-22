import { auth } from "@/auth";
import {
  buildMonthlyRows,
  daysInMonth,
  monthRangeUtc,
} from "@/lib/adminMonthlyAttendance";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseYearMonth(url: URL): { year: number; month: number } | null {
  const y = Number(url.searchParams.get("year"));
  const m = Number(url.searchParams.get("month"));
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

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

  const ym = parseYearMonth(url);
  if (!ym) {
    return NextResponse.json({ error: "year and month (1–12) required" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true, name: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const tz = company.timezone?.trim() || "Asia/Seoul";
  const { start, end } = monthRangeUtc(ym.year, ym.month, tz);

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        companyId,
        timestamp: { gte: start, lte: end },
      },
      select: {
        employeeId: true,
        type: true,
        timestamp: true,
        status: true,
      },
    }),
  ]);

  const rows = buildMonthlyRows(employees, records, ym.year, ym.month, tz);

  let completeDays = 0;
  let partialDays = 0;
  let pendingDays = 0;
  for (const row of rows) {
    for (const d of row.days) {
      if (d.pending) pendingDays++;
      if (d.checkIn && d.checkOut && !d.incomplete) completeDays++;
      else if (d.checkIn || d.checkOut) partialDays++;
    }
  }

  return NextResponse.json({
    year: ym.year,
    month: ym.month,
    timezone: tz,
    companyName: company.name,
    daysInMonth: daysInMonth(ym.year, ym.month),
    summary: {
      employeeCount: employees.length,
      completeDays,
      partialDays,
      pendingDays,
    },
    rows,
  });
}
