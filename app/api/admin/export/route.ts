import { auth } from "@/auth";
import {
  aggregateAttendanceByDay,
  filterAttendanceDayRows,
  type AttendancePunchSummary,
} from "@/lib/adminAttendanceByDay";
import { lateMinutesFor, overtimeMinutesFor } from "@/lib/companyWorkSchedule";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

const FONT_NAME = "맑은 고딕";
const FONT_SIZE = 9;
const MIN_COL_WIDTH = 8;
const MAX_COL_WIDTH = 60;

/** 한글은 한 글자가 ASCII보다 시각적으로 약 1.6~1.8배 넓다. 너비 계산 시 가중치를 준다. */
function visualWidth(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = String(value);
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x1100 && code <= 0x11ff) w += 2; // 한글 자모
    else if (code >= 0x2e80 && code <= 0x9fff) w += 2; // CJK
    else if (code >= 0xac00 && code <= 0xd7a3) w += 2; // 한글 음절
    else if (code >= 0xf900 && code <= 0xfaff) w += 2; // CJK 호환
    else w += 1;
  }
  return w;
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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      timezone: true,
      workStartTime: true,
      workEndTime: true,
      workDays: true,
    },
  });
  const tz = company?.timezone?.trim() || "Asia/Seoul";
  const schedule = {
    workStartTime: company?.workStartTime ?? null,
    workEndTime: company?.workEndTime ?? null,
    workDays: company?.workDays ?? null,
  };

  const status = url.searchParams.get("status") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const departmentId = url.searchParams.get("departmentId") ?? undefined;

  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId,
      ...(departmentId ? { employee: { departmentId } } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 5000,
    include: {
      employee: { select: { name: true } },
      site: { select: { name: true } },
    },
  });

  // 마이그레이션 이전 기록 보정 — lateMinutes/overtimeMinutes 가 0 이면 회사 스케줄로 즉석 계산
  const augmented = records.map((r) => {
    let lateMinutes = r.lateMinutes;
    let overtimeMinutes = r.overtimeMinutes;
    if (r.type === "CHECK_IN" && r.isLate && lateMinutes <= 0) {
      lateMinutes = lateMinutesFor(r.timestamp, tz, schedule);
    }
    if (r.type === "CHECK_OUT" && r.isOvertime && overtimeMinutes <= 0) {
      overtimeMinutes = overtimeMinutesFor(r.timestamp, tz, schedule);
    }
    return { ...r, lateMinutes, overtimeMinutes };
  });

  const days = filterAttendanceDayRows(
    aggregateAttendanceByDay(augmented, tz, status || undefined),
    { from, to, q }
  );

  type Row = Record<string, string | number>;
  /**
   * 위치 표기 우선순위:
   * 1) 출장 — 입력한 출장지명 사용
   * 2) 등록된 회사 사이트 — 사이트명 사용 (`site.name`)
   * 3) 미등록 — "위도,경도" 좌표 표기
   */
  function locationCell(p: AttendancePunchSummary | null | undefined): string {
    if (!p) return "";
    if (p.isBusinessTrip && p.businessTripLocation) return p.businessTripLocation;
    if (p.site?.name) return p.site.name;
    return `${p.latitude},${p.longitude}`;
  }

  /** 초과근무 시간을 "X시간 Y분" 으로 사람 친화적 포맷 */
  function durationText(min: number): string {
    if (!min || min <= 0) return "";
    if (min < 60) return `${min}분`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  }

  /** 출근/퇴근 timestamp 차이를 분으로 — 근무시간 셀에 사용 */
  function workMinutes(d: typeof days[number]): number {
    if (!d.checkIn || !d.checkOut) return 0;
    const diffMs =
      new Date(d.checkOut.timestamp).getTime() - new Date(d.checkIn.timestamp).getTime();
    return Math.max(0, Math.round(diffMs / 60000));
  }

  const sheetData: Row[] = days.map((d) => ({
    날짜: d.date,
    직원: d.employeeName,
    출근시각: d.checkIn?.time ?? "",
    퇴근시각: d.checkOut?.time ?? "",
    근무시간: durationText(workMinutes(d)),
    출근위치: locationCell(d.checkIn),
    퇴근위치: locationCell(d.checkOut),
    미완료: d.incomplete ? "Y" : "",
    상태: d.status,
    지각: d.isLate ? "Y" : "",
    지각시간: durationText(d.lateMinutes),
    조퇴: d.isEarlyLeave ? "Y" : "",
    초과근무: d.isOvertime ? "Y" : "",
    초과시간: durationText(d.overtimeMinutes),
    휴일근무: d.isHolidayWork ? "Y" : "",
    출장: d.checkIn?.isBusinessTrip ? "Y" : "",
    출장사유: d.checkIn?.businessTripReason ?? "",
    출근메모: d.checkIn?.memo ?? "",
    퇴근메모: d.checkOut?.memo ?? "",
  }));

  const headers =
    sheetData[0] !== undefined
      ? (Object.keys(sheetData[0]) as string[])
      : [
          "날짜",
          "직원",
          "출근시각",
          "퇴근시각",
          "근무시간",
          "출근위치",
          "퇴근위치",
          "미완료",
          "상태",
          "지각",
          "지각시간",
          "조퇴",
          "초과근무",
          "초과시간",
          "휴일근무",
          "출장",
          "출장사유",
          "출근메모",
          "퇴근메모",
        ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "HeresNow";
  wb.created = new Date();
  const ws = wb.addWorksheet("Attendance", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = headers.map((h) => ({ header: h, key: h }));
  for (const row of sheetData) {
    ws.addRow(row);
  }

  const baseFont = { name: FONT_NAME, size: FONT_SIZE } as const;
  const headerFont = { ...baseFont, bold: true } as const;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = rowNumber === 1 ? headerFont : baseFont;
      cell.alignment = {
        vertical: "middle",
        wrapText: false,
        ...(rowNumber === 1 ? { horizontal: "center" } : {}),
      };
    });
    row.height = rowNumber === 1 ? 18 : 16;
  });

  ws.columns.forEach((col, idx) => {
    const header = headers[idx] ?? "";
    let max = visualWidth(header);
    for (const row of sheetData) {
      const v = row[header];
      const w = visualWidth(v);
      if (w > max) max = w;
    }
    col.width = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, max + 2));
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buf = Buffer.from(arrayBuffer);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${companyId}.xlsx"`,
    },
  });
}
