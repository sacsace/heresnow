export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runCheckInReminders } from "@/lib/checkInReminders";
import { isWebPushConfigured } from "@/lib/webPush";
import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  /** ISO 시각 — 출근 ±15분 윈도우 테스트용 (미지정 시 현재 시각) */
  now: z.string().datetime().optional(),
});

/**
 * 개발 전용: 출근 알림 크론 로직 수동 실행 (CRON_SECRET 불필요).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  let now = new Date();
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (parsed.success && parsed.data.now) {
      now = new Date(parsed.data.now);
    }
  } catch {
    /* empty body OK */
  }

  const result = await runCheckInReminders(now);
  return NextResponse.json({ ...result, now: now.toISOString() });
}
