import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 본인 회사 근무지 목록 (테넌트 격리) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const sites = await prisma.site.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      allowedRadius: true,
      expectedCheckIn: true,
      expectedCheckOut: true,
    },
  });

  return NextResponse.json({ sites });
}
