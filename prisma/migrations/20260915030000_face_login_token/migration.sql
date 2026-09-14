-- CreateTable
CREATE TABLE "FaceLoginToken" (
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceLoginToken_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "FaceLoginToken_userId_idx" ON "FaceLoginToken"("userId");

-- CreateIndex
CREATE INDEX "FaceLoginToken_expiresAt_idx" ON "FaceLoginToken"("expiresAt");
