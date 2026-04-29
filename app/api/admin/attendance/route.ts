import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (
    role !== "COMPANY_ADMIN" &&
    role !== "HR_MANAGER" &&
    role !== "APPROVER" &&
    role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  let companyId = session.user.companyId;
  if (role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (!q) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    companyId = q;
  }
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const take = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 500);

  const rows = await prisma.attendanceRecord.findMany({
    where: {
      companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(status && ["APPROVED", "PENDING", "REJECTED"].includes(status)
        ? { status: status as "APPROVED" | "PENDING" | "REJECTED" }
        : {}),
    },
    orderBy: { timestamp: "desc" },
    take,
    include: {
      employee: { select: { name: true } },
      site: { select: { name: true, latitude: true, longitude: true } },
      exception: true,
    },
  });

  return NextResponse.json({ records: rows });
}
