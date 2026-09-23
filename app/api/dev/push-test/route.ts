export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { sendUserPushTest } from "@/lib/userPushTest";
import { NextResponse } from "next/server";

/**
 * 개발 전용: /api/user/push-subscription/test 와 동일 (로컬 확인용 별칭).
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await sendUserPushTest(session.user.id);
  if (!result.ok) {
    const status = result.error === "NOT_CONFIGURED" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, sent: result.sent });
}
