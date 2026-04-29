import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 본인 출퇴근 기록 (테넌트 + 본인 employee만) */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 200);

  const rows = await prisma.attendanceRecord.findMany({
    where: {
      companyId: session.user.companyId,
      employeeId: session.user.employeeId,
    },
    orderBy: { timestamp: "desc" },
    take,
    include: {
      site: { select: { name: true } },
      exception: { select: { id: true, status: true, reason: true } },
    },
  });

  return NextResponse.json({ records: rows });
}
