export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import type { Locale } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured, sendWebPush } from "@/lib/webPush";
import { NextResponse } from "next/server";

/**
 * 개발 전용: 현재 로그인 사용자에게 즉시 테스트 푸시 1건 발송.
 * Chrome localhost에서 구독 등록 후 확인용.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });
  if (subs.length === 0) {
    return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 400 });
  }

  let sent = 0;
  const removed: string[] = [];
  for (const sub of subs) {
    const locale: Locale = sub.locale === "en" ? "en" : "ko";
    const payload =
      locale === "en"
        ? {
            title: "HeresNow test",
            body: "Push delivery works. This is a dev test notification.",
            url: "/employee",
            tag: "dev-push-test",
          }
        : {
            title: "HeresNow 테스트",
            body: "푸시 알림이 정상 동작합니다. (개발 테스트)",
            url: "/employee",
            tag: "dev-push-test",
          };

    const result = await sendWebPush(sub, payload);
    if (result.ok) {
      sent += 1;
    } else if (result.gone) {
      removed.push(sub.id);
    }
  }

  if (removed.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: removed } } });
  }

  return NextResponse.json({
    ok: sent > 0,
    sent,
    subscriptions: subs.length,
    removedStale: removed.length,
  });
}
