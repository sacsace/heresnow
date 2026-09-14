import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

/** 계정당 동시 로그인 가능 기기 수 */
export const MAX_USER_SESSIONS = 2;

export const SESSION_KICK_REASON_ANOTHER_DEVICE = "ANOTHER_DEVICE" as const;
export type SessionKickReason = typeof SESSION_KICK_REASON_ANOTHER_DEVICE;

const KICK_NOTICE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function issueUserSession(
  userId: string,
  maxAgeSec: number
): Promise<{ sessionNonce: string }> {
  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const rows = await tx.userSession.findMany({
      where: { userId },
      orderBy: { lastUsedAt: "asc" },
    });

    const expiredIds = rows.filter((r) => r.expiresAt && r.expiresAt <= now).map((r) => r.id);
    if (expiredIds.length > 0) {
      await tx.userSession.deleteMany({ where: { id: { in: expiredIds } } });
    }

    const active = rows.filter((r) => !r.expiresAt || r.expiresAt > now);
    const evictCount = Math.max(0, active.length - MAX_USER_SESSIONS + 1);
    for (let i = 0; i < evictCount; i++) {
      const oldest = active[i];
      if (!oldest) continue;
      await tx.userSessionKick.upsert({
        where: { userId_nonce: { userId, nonce: oldest.nonce } },
        create: {
          userId,
          nonce: oldest.nonce,
          reason: SESSION_KICK_REASON_ANOTHER_DEVICE,
          expiresAt: new Date(Date.now() + KICK_NOTICE_TTL_MS),
        },
        update: {
          reason: SESSION_KICK_REASON_ANOTHER_DEVICE,
          expiresAt: new Date(Date.now() + KICK_NOTICE_TTL_MS),
        },
      });
      await tx.userSession.delete({ where: { id: oldest.id } });
    }

    await tx.userSession.create({
      data: { userId, nonce, expiresAt },
    });

    await tx.user.update({
      where: { id: userId },
      data: { sessionNonce: null },
    });
  });

  return { sessionNonce: nonce };
}

export async function validateUserSession(userId: string, nonce: string): Promise<boolean> {
  const row = await prisma.userSession.findFirst({
    where: { userId, nonce },
  });
  if (!row) return false;

  const now = new Date();
  if (row.expiresAt && row.expiresAt <= now) {
    await prisma.userSession.delete({ where: { id: row.id } }).catch(() => {});
    return false;
  }

  void prisma.userSession
    .update({
      where: { id: row.id },
      data: { lastUsedAt: now },
    })
    .catch(() => {});

  return true;
}

export async function consumeSessionKickNotice(
  userId: string,
  nonce: string
): Promise<SessionKickReason | null> {
  const now = new Date();
  const row = await prisma.userSessionKick.findUnique({
    where: { userId_nonce: { userId, nonce } },
  });
  if (!row) return null;
  await prisma.userSessionKick.delete({ where: { id: row.id } }).catch(() => {});
  if (row.expiresAt <= now) return null;
  return row.reason as SessionKickReason;
}

export async function extendUserSessionExpiry(
  userId: string,
  nonce: string,
  maxAgeSec: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);
  await prisma.userSession
    .updateMany({
      where: { userId, nonce },
      data: { expiresAt, lastUsedAt: new Date() },
    })
    .catch(() => {});
}

export async function revokeUserSession(userId: string, nonce: string): Promise<void> {
  await Promise.all([
    prisma.userSession.deleteMany({ where: { userId, nonce } }),
    prisma.userSessionKick.deleteMany({ where: { userId, nonce } }).catch(() => {}),
  ]);
}
