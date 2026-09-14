-- AlterTable
ALTER TABLE "EmployeeFaceCredential" ADD COLUMN "poseType" TEXT;
ALTER TABLE "EmployeeFaceCredential" ADD COLUMN "qualityScore" DOUBLE PRECISION;
ALTER TABLE "EmployeeFaceCredential" ADD COLUMN "enrollmentBatchId" TEXT;

-- CreateIndex
CREATE INDEX "EmployeeFaceCredential_enrollmentBatchId_idx" ON "EmployeeFaceCredential"("enrollmentBatchId");
