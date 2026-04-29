import { auth } from "@/auth";
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

  const rows = await prisma.attendanceRecord.findMany({
    where: { companyId },
    orderBy: { timestamp: "desc" },
    take: 5000,
    include: {
      employee: { select: { name: true } },
      site: { select: { name: true } },
    },
  });

  const sheetData = rows.map((r) => ({
    직원: r.employee.name,
    유형: r.type,
    시각: r.timestamp.toISOString(),
    근무지: r.site.name,
    위도: r.latitude,
    경도: r.longitude,
    정확도_m: r.accuracy,
    거리_m: Math.round(r.distanceFromSite),
    상태: r.status,
    지각: r.isLate ? "Y" : "",
    조퇴: r.isEarlyLeave ? "Y" : "",
    메모: r.memo ?? "",
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
