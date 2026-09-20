import type { Locale } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured, sendWebPush, type PushPayload } from "@/lib/webPush";

/** 사용자의 모든 구독 기기에 Web Push 발송 */
export async function sendPushToUser(
  userId: string,
  buildPayload: (locale: Locale) => PushPayload
): Promise<number> {
  if (!isWebPushConfigured()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true },
  });
  if (subscriptions.length === 0) return 0;

  const removedIds: string[] = [];
  let sent = 0;

  for (const sub of subscriptions) {
    const locale: Locale = sub.locale === "en" ? "en" : "ko";
    const payload = buildPayload(locale);
    const result = await sendWebPush(sub, payload);
    if (result.ok) {
      sent += 1;
      continue;
    }
    if (result.gone) removedIds.push(sub.id);
  }

  if (removedIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: removedIds } } });
  }

  return sent;
}
