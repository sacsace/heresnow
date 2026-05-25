import { prisma } from "@/lib/prisma";
import { BillingPeriod } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

/** 비로그인 공개: 가입 화면에서 요금제 표시 (?period=MONTHLY|YEARLY) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const periodParam = url.searchParams.get("period");
  const periodParsed = z.enum(["MONTHLY", "YEARLY"]).safeParse(periodParam);
  const period = periodParsed.success ? periodParsed.data : undefined;

  const tiers = await prisma.pricingTier.findMany({
    where: period ? { billingPeriod: period as BillingPeriod } : undefined,
    orderBy: [{ billingPeriod: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      minSeats: true,
      maxSeats: true,
      billingPeriod: true,
      priceAmount: true,
      currency: true,
      label: true,
      sortOrder: true,
      trialDays: true,
    },
  });
  return NextResponse.json({ tiers });
}
