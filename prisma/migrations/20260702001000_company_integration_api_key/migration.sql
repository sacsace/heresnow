-- CompanyIntegration: MVS API key hash/metadata
ALTER TABLE "CompanyIntegration"
ADD COLUMN "apiKeyHash" TEXT,
ADD COLUMN "apiKeyLast4" TEXT,
ADD COLUMN "apiKeyUpdatedAt" TIMESTAMP(3);
