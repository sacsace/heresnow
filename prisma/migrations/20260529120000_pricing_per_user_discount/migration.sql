-- 1인당 요금 및 회사별 할인
ALTER TABLE "PricingTier" ADD COLUMN "pricePerUser" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Company" ADD COLUMN "billingDiscountPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN "billingDiscountAmount" INTEGER NOT NULL DEFAULT 0;

-- 기존 구간 정액 → 1인당 요금 역산 (maxSeats 기준)
UPDATE "PricingTier"
SET "pricePerUser" = CASE
  WHEN "maxSeats" > 0 THEN GREATEST(0, "priceAmount" / "maxSeats")
  ELSE "priceAmount"
END
WHERE "pricePerUser" = 0;
