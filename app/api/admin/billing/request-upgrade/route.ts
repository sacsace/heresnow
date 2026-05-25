import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  targetTierId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "COMPANY_ADMIN" && session.user.role !== "HR_MANAGER") {
    return NextResponse.json({ error: "회사관리자·인사만 요청할 수 있습니다." }, { status: 403 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { pricingTier: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = await prisma.pricingTier.findUnique({ where: { id: parsed.data.targetTierId } });
  if (!target) {
    return NextResponse.json({ error: "유효하지 않은 요금제입니다." }, { status: 400 });
  }

  const currentMax = company.pricingTier?.maxSeats ?? company.seatLimit;
  if (target.maxSeats <= currentMax) {
    return NextResponse.json(
      { error: "현재보다 많은 좌석 상한을 가진 요금제만 신청할 수 있습니다." },
      { status: 400 }
    );
  }

  const existing = await prisma.billingRequest.findFirst({
    where: { companyId, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 처리 대기 중인 요청이 있습니다." }, { status: 400 });
  }

  await prisma.billingRequest.create({
    data: {
      companyId,
      targetTierId: target.id,
      amountDue: target.priceAmount,
      note: parsed.data.note?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
