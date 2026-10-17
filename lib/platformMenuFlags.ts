import { prisma } from "@/lib/prisma";

export type PlatformMenuFlags = {
  showWorkRequestsMenu: boolean;
  showBillingMenu: boolean;
};

const DEFAULT_FLAGS: PlatformMenuFlags = {
  showWorkRequestsMenu: false,
  showBillingMenu: false,
};

/** 전역 메뉴 표시 플래그 — 없으면 기본(숨김)으로 생성 */
export async function getPlatformMenuFlags(): Promise<PlatformMenuFlags> {
  try {
    const row = await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        showWorkRequestsMenu: false,
        showBillingMenu: false,
      },
      update: {},
      select: {
        showWorkRequestsMenu: true,
        showBillingMenu: true,
      },
    });
    return row;
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export async function updatePlatformMenuFlags(
  patch: Partial<PlatformMenuFlags>
): Promise<PlatformMenuFlags> {
  const row = await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      showWorkRequestsMenu: patch.showWorkRequestsMenu ?? false,
      showBillingMenu: patch.showBillingMenu ?? false,
    },
    update: {
      ...(patch.showWorkRequestsMenu !== undefined
        ? { showWorkRequestsMenu: patch.showWorkRequestsMenu }
        : {}),
      ...(patch.showBillingMenu !== undefined
        ? { showBillingMenu: patch.showBillingMenu }
        : {}),
    },
    select: {
      showWorkRequestsMenu: true,
      showBillingMenu: true,
    },
  });
  return row;
}
