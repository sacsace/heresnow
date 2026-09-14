export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runCheckInReminders } from "@/lib/checkInReminders";
import { verifyCronSecret } from "@/lib/cronAuth";
import { isWebPushConfigured } from "@/lib/webPush";
import { NextResponse } from "next/server";

/**
 * 출근 ±15분 Web Push 알림 (5분 크론 권장).
 * Authorization: Bearer {CRON_SECRET}
 */
export async function POST(req: Request) {
  const bearer = req.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null;
  if (!verifyCronSecret(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED", skipped: true }, { status: 503 });
  }

  const result = await runCheckInReminders();
  return NextResponse.json(result);
}
