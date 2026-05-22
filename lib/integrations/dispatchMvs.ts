import { isMvsAttendanceEventV1 } from "@/lib/integrations/mvsTypes";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";

const MAX_ATTEMPTS = 8;

export type DispatchMvsOptions = {
  companyId?: string;
  limit?: number;
};

/**
 * PENDING 아웃박스를 MVS webhookUrl로 POST.
 * MVS가 폴링만 쓰는 경우 이 함수는 no-op에 가깝게 동작(webhook 없음).
 */
export async function dispatchPendingMvsOutbox(
  options: DispatchMvsOptions = {}
): Promise<{ processed: number; delivered: number; failed: number }> {
  const limit = Math.min(options.limit ?? 50, 200);

  const pending = await prisma.integrationOutbox.findMany({
    where: {
      provider: IntegrationProvider.MVS,
      status: "PENDING",
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      company: {
        include: {
          integrations: {
            where: { provider: IntegrationProvider.MVS, enabled: true },
            take: 1,
          },
        },
      },
    },
  });

  let delivered = 0;
  let failed = 0;

  for (const row of pending) {
    const integration = row.company.integrations[0];
    const webhookUrl =
      integration?.webhookUrl?.trim() ||
      process.env.MVS_DEFAULT_WEBHOOK_URL?.trim() ||
      null;

    if (!integration?.enabled || !webhookUrl) {
      continue;
    }

    if (!isMvsAttendanceEventV1(row.payload)) {
      await markFailed(row.id, row.attempts, "Invalid payload schema");
      failed += 1;
      continue;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MVS_WEBHOOK_BEARER
            ? { Authorization: `Bearer ${process.env.MVS_WEBHOOK_BEARER}` }
            : {}),
        },
        body: JSON.stringify(row.payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`MVS webhook ${res.status}: ${text.slice(0, 500)}`);
      }

      await prisma.integrationOutbox.update({
        where: { id: row.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      delivered += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextAttempts = row.attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await markFailed(row.id, nextAttempts, message);
        failed += 1;
      } else {
        await prisma.integrationOutbox.update({
          where: { id: row.id },
          data: { attempts: nextAttempts, lastError: message },
        });
        failed += 1;
      }
    }
  }

  return { processed: pending.length, delivered, failed };
}

async function markFailed(id: string, attempts: number, lastError: string) {
  await prisma.integrationOutbox.update({
    where: { id },
    data: { status: "FAILED", attempts, lastError },
  });
}
