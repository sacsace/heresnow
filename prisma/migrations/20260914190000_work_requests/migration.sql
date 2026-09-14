-- CreateEnum
CREATE TYPE "WorkRequestType" AS ENUM ('EARLY_LEAVE', 'OVERTIME');

-- CreateTable
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "WorkRequestType" NOT NULL,
    "workDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "extraMinutes" INTEGER,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolverUserId" TEXT,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkRequest_companyId_status_idx" ON "WorkRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "WorkRequest_employeeId_idx" ON "WorkRequest"("employeeId");

-- CreateIndex
CREATE INDEX "WorkRequest_companyId_type_status_idx" ON "WorkRequest"("companyId", "type", "status");

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_resolverUserId_fkey" FOREIGN KEY ("resolverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
