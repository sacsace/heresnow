import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role;
  if (
    role !== "COMPANY_ADMIN" &&
    role !== "HR_MANAGER" &&
    role !== "APPROVER"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { pricingTier: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const employeeCount = await prisma.employee.count({ where: { companyId } });
  const tiers = await prisma.pricingTier.findMany({ orderBy: { sortOrder: "asc" } });
  const currentMaxSeats = company.pricingTier?.maxSeats ?? company.seatLimit;
  // 결제 주기 무관하게 좌석 상한이 더 큰 모든 티어를 반환 — 클라이언트에서 월/년 선택 후 필터.
  const upgradeTiers = tiers.filter((t) => t.maxSeats > currentMaxSeats);

  const pendingRequest = await prisma.billingRequest.findFirst({
    where: { companyId, status: "PENDING" },
    include: { targetTier: true },
  });

  return NextResponse.json({
    company: {
      name: company.name,
      seatLimit: company.seatLimit,
      subscriptionEndsAt: company.subscriptionEndsAt,
      pricingTier: company.pricingTier,
    },
    employeeCount,
    upgradeTiers,
    pendingRequest,
  });
}
