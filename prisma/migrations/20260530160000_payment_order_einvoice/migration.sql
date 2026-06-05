-- CreateEnum
CREATE TYPE "EInvoiceStatus" AS ENUM ('SKIPPED', 'PENDING', 'ISSUED', 'FAILED');

ALTER TABLE "PaymentOrder" ADD COLUMN "eInvoiceStatus" "EInvoiceStatus" NOT NULL DEFAULT 'SKIPPED';
ALTER TABLE "PaymentOrder" ADD COLUMN "eInvoiceIrn" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "eInvoiceAckNo" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "eInvoiceAckAt" TIMESTAMP(3);
ALTER TABLE "PaymentOrder" ADD COLUMN "eInvoiceSignedQrCode" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "eInvoiceLastError" TEXT;
