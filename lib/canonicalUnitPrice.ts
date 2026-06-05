import type { PrismaClient } from "@prisma/client";

export const CANONICAL_MIN_SEATS = 1;
export const CANONICAL_MAX_SEATS = 999_999;
export const CANONICAL_LABEL = "1인당 월 요금";

type Db = Pick<PrismaClient, "pricingTier" | "company" | "$transaction">;

export async function getOrCreateCanonicalMonthlyTier(prisma: Db) {
  const existing = await prisma.pricingTier.findUnique({
    where: {
      minSeats_maxSeats_billingPeriod: {
        minSeats: CANONICAL_MIN_SEATS,
        maxSeats: CANONICAL_MAX_SEATS,
        billingPeriod: "MONTHLY",
      },
    },
  });
  if (existing) return existing;

  const fallback = await prisma.pricingTier.findFirst({
    where: { billingPeriod: "MONTHLY" },
    orderBy: { sortOrder: "asc" },
  });
  const pricePerUser = Math.max(0, fallback?.pricePerUser ?? 35);

  return prisma.pricingTier.create({
    data: {
      minSeats: CANONICAL_MIN_SEATS,
      maxSeats: CANONICAL_MAX_SEATS,
      billingPeriod: "MONTHLY",
      pricePerUser,
      priceAmount: pricePerUser,
      label: CANONICAL_LABEL,
      sortOrder: 0,
      currency: "INR",
      trialDays: fallback?.trialDays ?? null,
    },
  });
}

/** 슈퍼관리자: 1인당 월 요금 저장 — 모든 회사·티어 단가 동기화 */
export async function saveCanonicalUnitPrice(prisma: Db, pricePerUser: number) {
  const ppu = Math.max(0, Math.round(pricePerUser));

  return prisma.$transaction(async (tx) => {
    const canonical = await tx.pricingTier.upsert({
      where: {
        minSeats_maxSeats_billingPeriod: {
          minSeats: CANONICAL_MIN_SEATS,
          maxSeats: CANONICAL_MAX_SEATS,
          billingPeriod: "MONTHLY",
        },
      },
      create: {
        minSeats: CANONICAL_MIN_SEATS,
        maxSeats: CANONICAL_MAX_SEATS,
        billingPeriod: "MONTHLY",
        pricePerUser: ppu,
        priceAmount: ppu,
        label: CANONICAL_LABEL,
        sortOrder: 0,
        currency: "INR",
      },
      update: {
        pricePerUser: ppu,
        priceAmount: ppu,
        billingPeriod: "MONTHLY",
        label: CANONICAL_LABEL,
      },
    });

    await tx.pricingTier.updateMany({
      data: { pricePerUser: ppu },
    });

    await tx.company.updateMany({
      data: { pricingTierId: canonical.id },
    });

    return canonical;
  });
}
