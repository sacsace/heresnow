-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('MVS');
CREATE TYPE "IntegrationOutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "externalEmployeeId" TEXT;

-- CreateTable
CREATE TABLE "CompanyIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "externalCompanyId" TEXT,
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "IntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyIntegration_companyId_provider_key" ON "CompanyIntegration"("companyId", "provider");
CREATE INDEX "CompanyIntegration_companyId_idx" ON "CompanyIntegration"("companyId");
CREATE UNIQUE INDEX "IntegrationOutbox_provider_resourceId_eventType_key" ON "IntegrationOutbox"("provider", "resourceId", "eventType");
CREATE INDEX "IntegrationOutbox_status_createdAt_idx" ON "IntegrationOutbox"("status", "createdAt");
CREATE INDEX "IntegrationOutbox_companyId_provider_idx" ON "IntegrationOutbox"("companyId", "provider");

ALTER TABLE "CompanyIntegration" ADD CONSTRAINT "CompanyIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
