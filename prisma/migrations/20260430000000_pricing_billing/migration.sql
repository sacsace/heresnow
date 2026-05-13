-- CreateEnum
CREATE TYPE "BillingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" TEXT NOT NULL,
    "minSeats" INTEGER NOT NULL,
    "maxSeats" INTEGER NOT NULL,
    "pricePerYear" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingTier_minSeats_maxSeats_key" ON "PricingTier"("minSeats", "maxSeats");

-- CreateTable
CREATE TABLE "BillingRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetTierId" TEXT NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "status" "BillingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolverUserId" TEXT,

    CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "pricingTierId" TEXT,
ADD COLUMN     "seatLimit" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "subscriptionEndsAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_targetTierId_fkey" FOREIGN KEY ("targetTierId") REFERENCES "PricingTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_resolverUserId_fkey" FOREIGN KEY ("resolverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BillingRequest_companyId_idx" ON "BillingRequest"("companyId");

CREATE INDEX "BillingRequest_status_idx" ON "BillingRequest"("status");
