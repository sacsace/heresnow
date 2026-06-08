export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getClientIp } from "@/lib/clientIp";
import { sendSupportEmail } from "@/lib/sendSupportEmail";
import { isSupportEmailConfigured } from "@/lib/supportContact";
import { consumeRateLimit } from "@/lib/slidingWindowRateLimit";
import { NextResponse } from "next/server";
import { z } from "zod";

const SUPPORT_MAX_ATTEMPTS = 5;
const SUPPORT_WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(4000),
  pageUrl: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  if (!isSupportEmailConfigured()) {
    return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });
  }

  const ip = getClientIp(req);
  const rate = consumeRateLimit(`support:${ip}`, SUPPORT_MAX_ATTEMPTS, SUPPORT_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const session = await auth();
  const { name, email, message, pageUrl } = parsed.data;

  try {
    await sendSupportEmail({
      name,
      email,
      message,
      meta: {
        userId: session?.user?.id ?? null,
        userEmail: session?.user?.email ?? null,
        pageUrl: pageUrl ?? req.headers.get("referer"),
        ip,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[public/support POST]", e);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
