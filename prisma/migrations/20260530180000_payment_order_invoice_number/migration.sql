-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN "invoiceNumber" TEXT;

-- CreateTable
CREATE TABLE "InvoiceNumberSequence" (
    "financialYear" TEXT NOT NULL,
    "lastSerial" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceNumberSequence_pkey" PRIMARY KEY ("financialYear")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_invoiceNumber_key" ON "PaymentOrder"("invoiceNumber");
