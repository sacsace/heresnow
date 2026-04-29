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

  let companyId = session.user.companyId;
  if (role === "SUPER_ADMIN") {
    const q = new URL(req.url).searchParams.get("companyId");
    if (!q) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    companyId = q;
  }

  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { user: { select: { email: true, role: true } } },
  });

  return NextResponse.json({ employees });
}
