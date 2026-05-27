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
import { buildAttendancePresenceMatrix, resolveExportDateRange } from "@/lib/attendanceExportMatrix";
import { DEFAULT_COMPANY_TIMEZONE, recordDisplayTimezone } from "@/lib/companyTimezones";
import { lateMinutesFor, overtimeMinutesFor } from "@/lib/companyWorkSchedule";
import { STORAGE_KEY } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { fromZonedTime } from "date-fns-tz";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MIN_COL_WIDTH = 6;
const MAX_COL_WIDTH = 24;

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
  const locale = parseExportLocale(
    url.searchParams.get("lang") ?? cookieStore.get(STORAGE_KEY)?.value
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
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  const tz = company.timezone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const downloadFilename = attendanceExportFilename(company.name, tz, locale);
  const schedule = {
    workStartTime: company.workStartTime ?? null,
    workEndTime: company.workEndTime ?? null,
    workDays: company.workDays ?? null,
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

  const [records, employees] = await Promise.all([
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
  ]);

  const augmented = records.map((r) => {
    let lateMinutes = r.lateMinutes;
    let overtimeMinutes = r.overtimeMinutes;
    const rt = recordDisplayTimezone(r, tz);
    if (r.type === "CHECK_IN" && r.isLate && lateMinutes <= 0) {
      lateMinutes = lateMinutesFor(r.timestamp, rt, schedule);
    }
    if (r.type === "CHECK_OUT" && r.isOvertime && overtimeMinutes <= 0) {
      overtimeMinutes = overtimeMinutesFor(r.timestamp, rt, schedule);
    }
    return { ...r, lateMinutes, overtimeMinutes };
  });

  const days = filterAttendanceDayRows(
    aggregateAttendanceByDay(augmented, tz, status || undefined),
    { from: fromParam, to: toParam, q }
  );

  const { from, to } = resolveExportDateRange(fromParam, toParam, days, tz);
  const matrix = buildAttendancePresenceMatrix(days, employees, from, to, {
    workDays: company.workDays,
    timeZone: tz,
  });

  const dataHeaders = [labels.nameCol, ...matrix.dateHeaders, ...labels.summaryHeaders];
  const legendMergeCols = Math.min(Math.max(dataHeaders.length, 4), 12);

  const wb = new ExcelJS.Workbook();
  wb.creator = "HeresNow";
  wb.created = new Date();
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
