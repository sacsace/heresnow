export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 전체 승인/처리 로그 (SUPER_ADMIN) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.approvalLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 200,
    include: {
      approver: { select: { email: true, role: true } },
      company: { select: { name: true } },
    },
  });

  return NextResponse.json({ logs });
}
