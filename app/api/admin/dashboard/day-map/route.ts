import { auth } from "@/auth";
import { calendarDayInTz, timeInTz } from "@/lib/adminMonthlyAttendance";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";

const DAY_PAD_MS = 36 * 60 * 60 * 1000;
/** 기간 조회 상한 (영업일·주말 포함). 너무 큰 범위는 마커 과다로 가독성이 떨어진다. */
const RANGE_MAX_DAYS = 31;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function diffDaysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

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

    // 단일 날짜(date=YYYY-MM-DD) 또는 기간(from/to) 모드를 지원
    const dateParam = url.searchParams.get("date");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let from: string;
    let to: string;
    if (dateParam && DATE_RE.test(dateParam)) {
      from = dateParam;
      to = dateParam;
    } else if (fromParam && toParam && DATE_RE.test(fromParam) && DATE_RE.test(toParam)) {
      if (fromParam > toParam) {
        return NextResponse.json(
          { error: "INVALID_RANGE", message: "시작일이 종료일보다 늦을 수 없습니다." },
          { status: 400 }
        );
      }
      const days = diffDaysInclusive(fromParam, toParam);
      if (days > RANGE_MAX_DAYS) {
        return NextResponse.json(
          {
            error: "RANGE_TOO_LARGE",
            message: `기간은 최대 ${RANGE_MAX_DAYS}일까지 조회할 수 있습니다.`,
            maxDays: RANGE_MAX_DAYS,
          },
          { status: 400 }
        );
      }
      from = fromParam;
      to = toParam;
    } else {
      return NextResponse.json(
        { error: "date(YYYY-MM-DD) 또는 from/to(YYYY-MM-DD) 가 필요합니다." },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const tz = company.timezone?.trim() || "Asia/Seoul";
    const rangeStart = fromZonedTime(`${from} 00:00:00`, tz);
    const rangeEnd = fromZonedTime(`${to} 23:59:59.999`, tz);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        companyId,
        type: "CHECK_IN",
        timestamp: {
          gte: new Date(rangeStart.getTime() - DAY_PAD_MS),
          lte: new Date(rangeEnd.getTime() + DAY_PAD_MS),
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

    /**
     * 직원별 + 일자별 첫 체크인만 마커로 사용.
     * - 단일 날짜: 직원 1명당 1개 마커 (기존 동작과 동일)
     * - 기간: 직원 N명 × 며칠 = 직원·일자별 마커
     */
    type MarkerSource = (typeof records)[number] & { day: string };
    const seen = new Map<string, MarkerSource>();
    for (const r of records) {
      const day = calendarDayInTz(r.timestamp, tz);
      if (day < from || day > to) continue;
      const key = `${r.employeeId}:${day}`;
      if (!seen.has(key)) {
        seen.set(key, { ...r, day });
      }
    }

    const markers = [...seen.values()].map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      attendanceId: r.id,
      timestamp: r.timestamp.toISOString(),
      checkInTime: timeInTz(r.timestamp, tz),
      date: r.day,
      latitude: r.latitude,
      longitude: r.longitude,
      isBusinessTrip: r.isBusinessTrip,
      businessTripLocation: r.businessTripLocation,
      businessTripReason: r.businessTripReason,
    }));

    return NextResponse.json({
      from,
      to,
      // 하위 호환: 단일 날짜 모드에서는 date 필드도 함께 노출
      ...(from === to ? { date: from } : {}),
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
