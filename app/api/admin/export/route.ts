import { auth } from "@/auth";
import { aggregateAttendanceByDay, filterAttendanceDayRows } from "@/lib/adminAttendanceByDay";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

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
    select: { timezone: true },
  });
  const tz = company?.timezone?.trim() || "Asia/Seoul";

  const status = url.searchParams.get("status") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const records = await prisma.attendanceRecord.findMany({
    where: { companyId },
    orderBy: { timestamp: "desc" },
    take: 5000,
    include: {
      employee: { select: { name: true } },
      site: { select: { name: true } },
    },
  });

  const days = filterAttendanceDayRows(
    aggregateAttendanceByDay(records, tz, status || undefined),
    { from, to, q }
  );

  const sheetData = days.map((d) => ({
    날짜: d.date,
    직원: d.employeeName,
    출근시각: d.checkIn?.time ?? "",
    퇴근시각: d.checkOut?.time ?? "",
    출근위도: d.checkIn?.latitude ?? "",
    출근경도: d.checkIn?.longitude ?? "",
    퇴근위도: d.checkOut?.latitude ?? "",
    퇴근경도: d.checkOut?.longitude ?? "",
    미완료: d.incomplete ? "Y" : "",
    상태: d.status,
    지각: d.isLate ? "Y" : "",
    조퇴: d.isEarlyLeave ? "Y" : "",
    초과근무: d.isOvertime ? "Y" : "",
    초과분: d.overtimeMinutes > 0 ? d.overtimeMinutes : "",
    휴일근무: d.isHolidayWork ? "Y" : "",
    출장: d.checkIn?.isBusinessTrip ? "Y" : "",
    출장지역: d.checkIn?.businessTripLocation ?? "",
    출장사유: d.checkIn?.businessTripReason ?? "",
    출근메모: d.checkIn?.memo ?? "",
    퇴근메모: d.checkOut?.memo ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${companyId}.xlsx"`,
    },
  });
}
