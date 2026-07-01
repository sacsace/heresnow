export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { aggregateAttendanceByDay, filterAttendanceDayRows } from "@/lib/adminAttendanceByDay";
import { monthRangeUtc } from "@/lib/adminMonthlyAttendance";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
});

/** 회사 관리자: MVS 전송 대상 월별 직원 출퇴근 미리보기 */
export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  const companyId = session?.user?.companyId;
  if (
    !session?.user?.id ||
    !companyId ||
    (role !== "COMPANY_ADMIN" && role !== "HR_MANAGER" && role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [yearText, monthText] = parsed.data.month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const timeZone = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const { start, end, daysInMonth } = monthRangeUtc(year, monthNumber, timeZone);
  const fromDate = `${parsed.data.month}-01`;
  const toDate = `${parsed.data.month}-${String(daysInMonth).padStart(2, "0")}`;

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        externalEmployeeId: true,
        user: { select: { email: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        companyId,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        employeeId: true,
        type: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        distanceFromSite: true,
        outsideGeofence: true,
        status: true,
        isLate: true,
        isEarlyLeave: true,
        isOvertime: true,
        isHolidayWork: true,
        lateMinutes: true,
        overtimeMinutes: true,
        memo: true,
        isBusinessTrip: true,
        businessTripLocation: true,
        businessTripReason: true,
        recordTimezone: true,
        employee: { select: { name: true } },
        site: { select: { name: true } },
      },
    }),
  ]);

  const dayRows = filterAttendanceDayRows(aggregateAttendanceByDay(records, timeZone), {
    from: fromDate,
    to: toDate,
  });

  const employeeAttendance = employees
    .map((employee) => {
      const rows = dayRows
        .filter((row) => row.employeeId === employee.id)
        .map((row) => ({
          date: row.date,
          checkOutDate: row.checkOutDate,
          incomplete: row.incomplete,
          pending: row.pending,
          status: row.status,
          checkIn: row.checkIn
            ? {
                localTime: row.checkIn.time,
                timestamp: row.checkIn.timestamp,
              }
            : null,
          checkOut: row.checkOut
            ? {
                localTime: row.checkOut.time,
                timestamp: row.checkOut.timestamp,
              }
            : null,
        }));

      return {
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.user.email,
          externalEmployeeId: employee.externalEmployeeId,
        },
        rows,
      };
    })
    .filter((entry) => entry.rows.length > 0);

  const count = employeeAttendance.reduce((sum, entry) => sum + entry.rows.length, 0);
  return NextResponse.json({
    month: parsed.data.month,
    timezone: timeZone,
    count,
    employeeAttendance,
  });
}
