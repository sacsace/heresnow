import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 비로그인 공개: 가입 화면에서 요금제 표시 */
export async function GET() {
  const tiers = await prisma.pricingTier.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      minSeats: true,
      maxSeats: true,
      pricePerYear: true,
      currency: true,
      label: true,
      sortOrder: true,
      trialDays: true,
    },
  });
  return NextResponse.json({ tiers });
}
