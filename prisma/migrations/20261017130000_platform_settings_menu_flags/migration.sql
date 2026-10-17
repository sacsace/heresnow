-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "showWorkRequestsMenu" BOOLEAN NOT NULL DEFAULT false,
    "showBillingMenu" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Seed defaults (menus hidden until root enables)
INSERT INTO "PlatformSettings" ("id", "showWorkRequestsMenu", "showBillingMenu", "updatedAt")
VALUES ('default', false, false, CURRENT_TIMESTAMP);
