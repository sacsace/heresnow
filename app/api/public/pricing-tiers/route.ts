export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getOrCreateCanonicalMonthlyTier } from "@/lib/canonicalUnitPrice";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 비로그인 공개: 가입 화면 — 1인당 월 요금만 */
export async function GET() {
  try {
    const tier = await getOrCreateCanonicalMonthlyTier(prisma);
    return NextResponse.json({
      tiers: [
        {
          id: tier.id,
          minSeats: tier.minSeats,
          maxSeats: tier.maxSeats,
          billingPeriod: tier.billingPeriod,
          priceAmount: tier.priceAmount,
          pricePerUser: tier.pricePerUser,
          currency: tier.currency,
          label: tier.label,
          sortOrder: tier.sortOrder,
          trialDays: tier.trialDays,
        },
      ],
    });
  } catch {
    return NextResponse.json({ tiers: [] }, { status: 500 });
  }
}
