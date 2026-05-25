-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "PricingTier" ADD COLUMN "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'YEARLY';
ALTER TABLE "PricingTier" RENAME COLUMN "pricePerYear" TO "priceAmount";

-- DropIndex
DROP INDEX "PricingTier_minSeats_maxSeats_key";

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_minSeats_maxSeats_billingPeriod_key" ON "PricingTier"("minSeats", "maxSeats", "billingPeriod");
