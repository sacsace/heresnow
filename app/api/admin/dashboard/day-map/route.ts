import { auth } from "@/auth";
import { calendarDayInTz, timeInTz } from "@/lib/adminMonthlyAttendance";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

export async function GET(req: Request) {
  try {
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

    const parsed = querySchema.safeParse({ date: url.searchParams.get("date") });
    if (!parsed.success) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
    }

    const { date } = parsed.data;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const tz = company.timezone?.trim() || "Asia/Seoul";
    const dayStart = fromZonedTime(`${date} 00:00:00`, tz);
    const dayEnd = fromZonedTime(`${date} 23:59:59.999`, tz);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        companyId,
        type: "CHECK_IN",
        timestamp: {
          gte: new Date(dayStart.getTime() - DAY_PAD_MS),
          lte: new Date(dayEnd.getTime() + DAY_PAD_MS),
        },
      },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        employeeId: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        isBusinessTrip: true,
        businessTripLocation: true,
        businessTripReason: true,
        employee: { select: { name: true } },
      },
    });

    const byEmployee = new Map<string, (typeof records)[number]>();
    for (const r of records) {
      if (calendarDayInTz(r.timestamp, tz) !== date) continue;
      if (!byEmployee.has(r.employeeId)) {
        byEmployee.set(r.employeeId, r);
      }
    }

    const markers = [...byEmployee.values()].map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      attendanceId: r.id,
      timestamp: r.timestamp.toISOString(),
      checkInTime: timeInTz(r.timestamp, tz),
      latitude: r.latitude,
      longitude: r.longitude,
      isBusinessTrip: r.isBusinessTrip,
      businessTripLocation: r.businessTripLocation,
      businessTripReason: r.businessTripReason,
    }));

    return NextResponse.json({
      date,
      timezone: tz,
      count: markers.length,
      markers,
    });
  } catch (e) {
    console.error("[day-map]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json(
      { error: `출근 위치 조회 실패: ${message}` },
      { status: 500 }
    );
  }
}
