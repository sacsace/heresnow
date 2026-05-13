-- AlterTable
ALTER TABLE "PricingTier" ADD COLUMN "trialDays" INTEGER;

-- 1좌석 · 7일 무료 체험 티어 (기존 DB에 (1,1) 행이 없을 때만 삽입)
INSERT INTO "PricingTier" ("id", "minSeats", "maxSeats", "pricePerYear", "currency", "label", "sortOrder", "trialDays", "createdAt", "updatedAt")
SELECT 'tier_free_7d_1seat', 1, 1, 0, 'INR', NULL, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "PricingTier" WHERE "minSeats" = 1 AND "maxSeats" = 1);
