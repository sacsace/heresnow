-- CreateTable
CREATE TABLE "UserSessionKick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSessionKick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSessionKick_userId_nonce_key" ON "UserSessionKick"("userId", "nonce");

-- CreateIndex
CREATE INDEX "UserSessionKick_expiresAt_idx" ON "UserSessionKick"("expiresAt");
