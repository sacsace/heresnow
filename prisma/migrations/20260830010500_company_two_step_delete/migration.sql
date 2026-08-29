-- Two-step company deletion support:
-- 1st delete => deactivate (isActive=false)
-- 2nd delete => hard delete
ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
