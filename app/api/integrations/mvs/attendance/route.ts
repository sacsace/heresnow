export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { verifyMvsApiKeyHash, verifyMvsIntegrationApiKey } from "@/lib/integrations/mvsAuth";
import { isMvsAttendanceEventV1 } from "@/lib/integrations/mvsTypes";
import { filterAttendanceDayRows, aggregateAttendanceByDay } from "@/lib/adminAttendanceByDay";
import { monthRangeUtc } from "@/lib/adminMonthlyAttendance";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

function apiKeyFromRequest(req: Request): string | null {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();
  return req.headers.get("x-mvs-api-key")?.trim() ?? null;
}

const querySchema = z.object({
  companyId: z.string().cuid().optional(),
  externalCompanyId: z.string().min(1).max(200).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM")
    .optional(),
  status: z.enum(["PENDING", "DELIVERED", "FAILED"]).default("PENDING"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().cuid().optional(),
});

/**
 * MVS가 HeresNow 출퇴근 이벤트를 폴링할 때 사용.
 * Authorization: Bearer {MVS_INTEGRATION_API_KEY}
 */
export async function GET(req: Request) {
  const apiKey = apiKeyFromRequest(req);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, externalCompanyId, month, status, limit, cursor } = parsed.data;

  if (!companyId && !externalCompanyId) {
    return NextResponse.json(
      { error: "companyId 또는 externalCompanyId가 필요합니다." },
      { status: 400 }
    );
  }

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && externalCompanyId) {
    const integration = await prisma.companyIntegration.findFirst({
      where: {
        provider: IntegrationProvider.MVS,
        externalCompanyId,
      },
      select: { companyId: true },
    });
    if (!integration) {
      return NextResponse.json({ error: "연동된 회사를 찾을 수 없습니다." }, { status: 404 });
    }
    resolvedCompanyId = integration.companyId;
  }

  const integration = await prisma.companyIntegration.findUnique({
    where: {
      companyId_provider: {
        companyId: resolvedCompanyId!,
        provider: IntegrationProvider.MVS,
      },
    },
    select: {
      enabled: true,
      externalCompanyId: true,
      apiKeyHash: true,
    },
  });

  const authorized =
    verifyMvsIntegrationApiKey(apiKey) ||
    verifyMvsApiKeyHash(apiKey, integration?.apiKeyHash);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!integration?.enabled) {
    return NextResponse.json({ error: "MVS 연동이 비활성화되어 있습니다." }, { status: 403 });
  }

  // 동기화 모드: 월 + 회사 + key로 "직원별 출퇴근" 데이터를 반환
  if (month) {
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    const company = await prisma.company.findUnique({
      where: { id: resolvedCompanyId! },
      select: { timezone: true },
    });
    const timeZone = company?.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
    const { start, end, daysInMonth } = monthRangeUtc(year, monthNumber, timeZone);
    const fromDate = `${month}-01`;
    const toDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;

    const [employees, records] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId: resolvedCompanyId! },
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
          companyId: resolvedCompanyId!,
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

    const toMappedPunch = (
      punch: (typeof dayRows)[number]["checkIn"] | (typeof dayRows)[number]["checkOut"]
    ) =>
      punch
        ? {
            attendanceId: punch.id,
            timestamp: punch.timestamp,
            localTime: punch.time,
            location: {
              latitude: punch.latitude,
              longitude: punch.longitude,
            },
            status: punch.status,
            distanceFromSiteMeters: punch.distanceFromSite,
            outsideGeofence: punch.outsideGeofence,
            memo: punch.memo,
            siteName: punch.site?.name ?? null,
            isBusinessTrip: punch.isBusinessTrip,
            businessTripLocation: punch.businessTripLocation,
            businessTripReason: punch.businessTripReason,
            isLate: punch.isLate,
            isEarlyLeave: punch.isEarlyLeave,
            isOvertime: punch.isOvertime,
            isHolidayWork: punch.isHolidayWork,
            lateMinutes: punch.lateMinutes,
            overtimeMinutes: punch.overtimeMinutes,
          }
        : null;

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
            isLate: row.isLate,
            isEarlyLeave: row.isEarlyLeave,
            isOvertime: row.isOvertime,
            isHolidayWork: row.isHolidayWork,
            lateMinutes: row.lateMinutes,
            overtimeMinutes: row.overtimeMinutes,
            checkIn: toMappedPunch(row.checkIn),
            checkOut: toMappedPunch(row.checkOut),
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
      mode: "monthly_employee_attendance",
      companyId: resolvedCompanyId,
      externalCompanyId: integration.externalCompanyId,
      month,
      timezone: timeZone,
      count,
      employeeAttendance,
    });
  }

  const rows = await prisma.integrationOutbox.findMany({
    where: {
      companyId: resolvedCompanyId!,
      provider: IntegrationProvider.MVS,
      status,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  const events = rows
    .map((r) => r.payload)
    .filter((p): p is NonNullable<typeof p> => isMvsAttendanceEventV1(p));

  return NextResponse.json({
    companyId: resolvedCompanyId,
    externalCompanyId: integration.externalCompanyId,
    status,
    count: events.length,
    nextCursor: rows.length === limit ? rows[rows.length - 1]?.id ?? null : null,
    events,
    outboxIds: rows.map((r) => r.id),
  });
}

const ackSchema = z.object({
  outboxIds: z.array(z.string().cuid()).min(1).max(500),
  companyId: z.string().cuid().optional(),
  externalCompanyId: z.string().min(1).max(200).optional(),
});

/** MVS가 수신 완료 후 호출 — 아웃박스를 DELIVERED로 표시 */
export async function POST(req: Request) {
  const apiKey = apiKeyFromRequest(req);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let resolvedCompanyId: string | null = parsed.data.companyId ?? null;
  if (!resolvedCompanyId && parsed.data.externalCompanyId) {
    const integration = await prisma.companyIntegration.findFirst({
      where: {
        provider: IntegrationProvider.MVS,
        externalCompanyId: parsed.data.externalCompanyId,
      },
      select: { companyId: true },
    });
    if (integration) resolvedCompanyId = integration.companyId;
  }

  if (!verifyMvsIntegrationApiKey(apiKey)) {
    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: "companyId 또는 externalCompanyId가 필요합니다." },
        { status: 400 }
      );
    }
    const integration = await prisma.companyIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: resolvedCompanyId,
          provider: IntegrationProvider.MVS,
        },
      },
      select: { apiKeyHash: true },
    });
    if (!verifyMvsApiKeyHash(apiKey, integration?.apiKeyHash)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const updated = await prisma.integrationOutbox.updateMany({
    where: {
      id: { in: parsed.data.outboxIds },
      provider: IntegrationProvider.MVS,
      status: "PENDING",
      ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
    },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
      lastError: null,
    },
  });

  return NextResponse.json({ acknowledged: updated.count });
}
