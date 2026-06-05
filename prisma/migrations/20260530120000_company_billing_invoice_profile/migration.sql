-- Company billing profile for tax invoices + payment snapshot
ALTER TABLE "Company" ADD COLUMN "billingLegalName" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingAddressLine1" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingAddressLine2" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingCity" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingState" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingPostalCode" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingCountry" TEXT DEFAULT 'India';
ALTER TABLE "Company" ADD COLUMN "billingGstin" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingEmail" TEXT;
ALTER TABLE "Company" ADD COLUMN "billingPhone" TEXT;

ALTER TABLE "PaymentOrder" ADD COLUMN "invoiceCustomerSnapshot" JSONB;
