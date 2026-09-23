export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { sendUserPushTest } from "@/lib/userPushTest";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 로그인 사용자 — 등록된 기기로 테스트 푸시 1건 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const subscriptionCount = await prisma.pushSubscription.count({
    where: { userId: session.user.id },
  });

  const result = await sendUserPushTest(session.user.id);
  if (!result.ok) {
    const status =
      result.error === "NOT_CONFIGURED" ? 503 : result.error === "NO_SUBSCRIPTION" ? 400 : 502;
    return NextResponse.json({ error: result.error, subscriptionCount }, { status });
  }

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    subscriptionCount,
  });
}
