import { auth } from "@/auth";
import type { Locale } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/webPush";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpsertBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  locale: z.enum(["ko", "en"]).optional(),
});

const DeleteBody = z.object({
  endpoint: z.string().url().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const configured = isWebPushConfigured();
  let count = 0;
  let dbReady = true;
  try {
    count = await prisma.pushSubscription.count({
      where: { userId: session.user.id },
    });
  } catch {
    dbReady = false;
    return NextResponse.json(
      {
        error: "DB_NOT_READY",
        configured,
        vapidPublicKey: getVapidPublicKey(),
        subscribed: false,
        subscriptionCount: 0,
        dbReady: false,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    configured,
    vapidPublicKey: getVapidPublicKey(),
    subscribed: count > 0,
    subscriptionCount: count,
    dbReady,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = UpsertBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const locale: Locale = parsed.data.locale === "en" ? "en" : "ko";
  const userAgent = req.headers.get("user-agent");

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: session.user.id,
        endpoint: parsed.data.endpoint,
      },
    },
    create: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      locale,
      userAgent,
    },
    update: {
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      locale,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let endpoint: string | undefined;
  try {
    const json = await req.json();
    const parsed = DeleteBody.safeParse(json);
    if (parsed.success) endpoint = parsed.data.endpoint;
  } catch {
    /* empty body OK — delete all */
  }

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id, endpoint },
    });
  } else {
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
