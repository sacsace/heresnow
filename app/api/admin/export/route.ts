export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import {
  aggregateAttendanceByDay,
  filterAttendanceDayRows,
} from "@/lib/adminAttendanceByDay";
import {
  dataHeaderRowIndex,
  styleAttendanceDataSheet,
  writeAttendanceLegend,
} from "@/lib/attendanceExportExcel";
import {
  attendanceExportFilename,
  contentDispositionAttachment,
} from "@/lib/attendanceExportFilename";
import { getAttendanceExportLabels, parseExportLocale } from "@/lib/attendanceExportI18n";
import {
  buildAttendancePresenceMatrix,
  enumerateDateRange,
  resolveExportDateRange,
} from "@/lib/attendanceExportMatrix";
import { DEFAULT_COMPANY_TIMEZONE, recordDisplayTimezone } from "@/lib/companyTimezones";
import { lateMinutesFor, overtimeMinutesFor, parseWorkDays } from "@/lib/companyWorkSchedule";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { STORAGE_KEY } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function visualWidth(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = String(value);
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x1100 && code <= 0x11ff) w += 2;
    else if (code >= 0x2e80 && code <= 0x9fff) w += 2;
    else if (code >= 0xac00 && code <= 0xd7a3) w += 2;
    else if (code >= 0xf900 && code <= 0xfaff) w += 2;
    else w += 1;
  }
  return w;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dateWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function formatLateDuration(minutes: number, locale: "ko" | "en"): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe <= 0) return "-";
  if (locale === "en") {
    if (safe < 60) return `${safe}m`;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  if (safe < 60) return `${safe}분`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.user.role !== "COMPANY_ADMIN" &&
    session.user.role !== "HR_MANAGER" &&
    session.user.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  let companyId = session.user.companyId;
  if (session.user.role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (!q) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    companyId = q;
  } else if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const localeHint =
    url.searchParams.get("lang") ??
    cookieStore.get(STORAGE_KEY)?.value ??
    req.headers.get("accept-language");
  const locale = parseExportLocale(
    localeHint
  );
  const labels = getAttendanceExportLabels(locale);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      timezone: true,
      workStartTime: true,
      workEndTime: true,
      workDays: true,
      workScheduleByDay: true,
      shiftPresets: true,
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const downloadFilename = attendanceExportFilename(company.name, tz, locale);
  const companySchedule = {
    workStartTime: company.workStartTime ?? null,
    workEndTime: company.workEndTime ?? null,
    workDays: company.workDays ?? null,
    workScheduleByDay: company.workScheduleByDay ?? null,
    shiftPresets: company.shiftPresets ?? null,
  };
  const defaultSchedule = {
    workStartTime: companySchedule.workStartTime,
    workEndTime: companySchedule.workEndTime,
    workDays: companySchedule.workDays,
    workScheduleByDay: companySchedule.workScheduleByDay,
  };

  const status = url.searchParams.get("status") ?? undefined;
  const fromParam = url.searchParams.get("from") ?? undefined;
  const toParam = url.searchParams.get("to") ?? undefined;
  const q = url.searchParams.get("q")?.trim() ?? undefined;
  const departmentId = url.searchParams.get("departmentId") ?? undefined;

  let timestampFilter: { gte: Date; lte: Date } | undefined;
  if (fromParam && toParam && DATE_ONLY.test(fromParam) && DATE_ONLY.test(toParam)) {
    const fromYmd = fromParam <= toParam ? fromParam : toParam;
    const toYmd = fromParam <= toParam ? toParam : fromParam;
    timestampFilter = {
      gte: fromZonedTime(`${fromYmd} 00:00:00`, tz),
      lte: fromZonedTime(`${toYmd} 23:59:59.999`, tz),
    };
  }

  const [records, employees, employeeSchedules] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        companyId,
        ...(departmentId ? { employee: { departmentId } } : {}),
        ...(timestampFilter ? { timestamp: timestampFilter } : {}),
      },
      orderBy: { timestamp: "asc" },
      include: {
        employee: { select: { name: true } },
        site: { select: { name: true } },
      },
    }),
    prisma.employee.findMany({
      where: {
        companyId,
        ...(departmentId ? { departmentId } : {}),
        ...(q
          ? { name: { contains: q, mode: "insensitive" as const } }
          : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        companyId,
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        workScheduleType: true,
        shiftCode: true,
        workStartTime: true,
        workEndTime: true,
        workScheduleByDay: true,
      },
    }),
  ]);

  const scheduleByEmployee = new Map(
    employeeSchedules.map((e) => [e.id, resolveEmployeeWorkSchedule(e, companySchedule)])
  );

  const augmented = records.map((r) => {
    let lateMinutes = r.lateMinutes;
    let overtimeMinutes = r.overtimeMinutes;
    const rt = recordDisplayTimezone(r, tz);
    const sched = scheduleByEmployee.get(r.employeeId) ?? defaultSchedule;
    if (r.type === "CHECK_IN" && r.isLate && lateMinutes <= 0) {
      lateMinutes = lateMinutesFor(r.timestamp, rt, sched);
    }
    if (r.type === "CHECK_OUT" && r.isOvertime && overtimeMinutes <= 0) {
      overtimeMinutes = overtimeMinutesFor(r.timestamp, rt, sched);
    }
    return { ...r, lateMinutes, overtimeMinutes };
  });

  const days = filterAttendanceDayRows(
    aggregateAttendanceByDay(augmented, tz, status || undefined),
    { from: fromParam, to: toParam, q }
  );

  const { from, to } = resolveExportDateRange(fromParam, toParam, days, tz);
  const wb = new ExcelJS.Workbook();
  wb.creator = "HeresNow";
  wb.created = new Date();
  const personalMode = Boolean(q);

  if (personalMode) {
    const ws = wb.addWorksheet(labels.personalSheetName);
    const includeNameCol = employees.length > 1;
    const headers = includeNameCol
      ? [labels.nameCol, ...labels.personalHeaders]
      : [...labels.personalHeaders];
    ws.addRow(headers);

    const workDaySet = parseWorkDays(company.workDays);
    const todayYmd = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    const dates = enumerateDateRange(from, to);

    type PersonalAgg = {
      checkInTime: string | null;
      checkInSite: string | null;
      checkOutTime: string | null;
      firstCheckInTs: string | null;
      lastCheckOutTs: string | null;
      isLate: boolean;
      lateMinutes: number;
    };
    const aggByEmployeeDate = new Map<string, Map<string, PersonalAgg>>();

    for (const row of days) {
      let byDate = aggByEmployeeDate.get(row.employeeId);
      if (!byDate) {
        byDate = new Map();
        aggByEmployeeDate.set(row.employeeId, byDate);
      }
      const current =
        byDate.get(row.date) ??
        ({
          checkInTime: null,
          checkInSite: null,
          checkOutTime: null,
          firstCheckInTs: null,
          lastCheckOutTs: null,
          isLate: false,
          lateMinutes: 0,
        } satisfies PersonalAgg);

      if (
        row.checkIn?.timestamp &&
        (!current.firstCheckInTs || row.checkIn.timestamp < current.firstCheckInTs)
      ) {
        current.firstCheckInTs = row.checkIn.timestamp;
        current.checkInTime = row.checkIn.time;
        current.checkInSite = row.checkIn.site?.name ?? null;
      }
      if (
        row.checkOut?.timestamp &&
        (!current.lastCheckOutTs || row.checkOut.timestamp > current.lastCheckOutTs)
      ) {
        current.lastCheckOutTs = row.checkOut.timestamp;
        current.checkOutTime = row.checkOut.time;
      }
      if (row.isLate) {
        current.isLate = true;
        current.lateMinutes = Math.max(current.lateMinutes, row.lateMinutes ?? 0);
      }

      byDate.set(row.date, current);
    }

    for (const employee of employees) {
      const byDate = aggByEmployeeDate.get(employee.id) ?? new Map<string, PersonalAgg>();
      for (const date of dates) {
        const agg = byDate.get(date);
        const hasAttendance = Boolean(agg?.checkInTime || agg?.checkOutTime);
        const isWorkday = workDaySet.has(dateWeekday(date));
        const isPastOrToday = date <= todayYmd;
        const absent = !hasAttendance && isWorkday && isPastOrToday;
        const late = Boolean(agg?.isLate);
        const lateDuration = formatLateDuration(agg?.lateMinutes ?? 0, labels.locale);
        const row = includeNameCol
          ? [
              employee.name,
              date,
              agg?.checkInTime ?? "-",
              agg?.checkOutTime ?? "-",
              agg?.checkInSite ?? "-",
              late ? labels.yesLabel : labels.noLabel,
              lateDuration,
              absent ? labels.yesLabel : labels.noLabel,
            ]
          : [
              date,
              agg?.checkInTime ?? "-",
              agg?.checkOutTime ?? "-",
              agg?.checkInSite ?? "-",
              late ? labels.yesLabel : labels.noLabel,
              lateDuration,
              absent ? labels.yesLabel : labels.noLabel,
            ];
        ws.addRow(row);
      }
    }

    const headerRow = ws.getRow(1);
    headerRow.height = 20;
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: labels.fontName, size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263238" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFB0BEC5" } },
        left: { style: "thin", color: { argb: "FFB0BEC5" } },
        bottom: { style: "thin", color: { argb: "FFB0BEC5" } },
        right: { style: "thin", color: { argb: "FFB0BEC5" } },
      };
    });

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        const leftAligned = includeNameCol ? c <= 2 : c <= 1;
        cell.font = { name: labels.fontName, size: 9 };
        cell.alignment = { vertical: "middle", horizontal: leftAligned ? "left" : "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCFD8DC" } },
          left: { style: "thin", color: { argb: "FFCFD8DC" } },
          bottom: { style: "thin", color: { argb: "FFCFD8DC" } },
          right: { style: "thin", color: { argb: "FFCFD8DC" } },
        };
      });
    }

    for (let c = 1; c <= headers.length; c += 1) {
      let max = visualWidth(headers[c - 1] ?? "");
      for (let r = 2; r <= ws.rowCount; r += 1) {
        max = Math.max(max, visualWidth(ws.getRow(r).getCell(c).value ?? ""));
      }
      ws.getColumn(c).width = Math.min(28, Math.max(8, max + 2));
    }
    ws.views = [{ state: "frozen", ySplit: 1 }];
  } else {
    const matrix = buildAttendancePresenceMatrix(days, employees, from, to, {
      workDays: company.workDays,
      timeZone: tz,
    });
    const dataHeaders = [labels.nameCol, ...matrix.dateHeaders, ...labels.summaryHeaders];
    const legendMergeCols = Math.min(Math.max(dataHeaders.length, 4), 12);
    const ws = wb.addWorksheet(labels.sheetName);

    writeAttendanceLegend(ws, labels, legendMergeCols);

    const dataHeaderRow = dataHeaderRowIndex(labels);
    ws.addRow(dataHeaders);
    for (const row of matrix.rows) {
      ws.addRow([
        row.name,
        ...row.cells,
        row.otTotal,
        row.absentDays,
        row.workDays,
        row.holidayWorkDays,
      ]);
    }

    styleAttendanceDataSheet(ws, matrix, labels, dataHeaderRow, visualWidth);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buf = Buffer.from(arrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDispositionAttachment(downloadFilename),
    },
  });
}
