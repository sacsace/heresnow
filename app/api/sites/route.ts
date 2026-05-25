import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 직원 UI: 회사 근무지 목록 (출근 반경 안내용) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await prisma.site.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      allowedRadius: true,
    },
  });

  return NextResponse.json({ sites });
}
