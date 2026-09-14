-- CreateTable
CREATE TABLE "EmployeeFaceCredential" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "descriptor" JSONB NOT NULL,
    "previewUrl" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeFaceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeFaceCredential_employeeId_idx" ON "EmployeeFaceCredential"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeFaceCredential" ADD CONSTRAINT "EmployeeFaceCredential_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single descriptors
INSERT INTO "EmployeeFaceCredential" ("id", "employeeId", "descriptor", "previewUrl", "createdAt")
SELECT
    'migrated_' || e."id",
    e."id",
    e."faceDescriptor",
    e."facePreviewUrl",
    COALESCE(e."faceEnrolledAt", NOW())
FROM "Employee" e
WHERE e."faceDescriptor" IS NOT NULL AND e."faceEnrolledAt" IS NOT NULL;
