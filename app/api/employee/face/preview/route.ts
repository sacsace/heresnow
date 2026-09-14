export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getClientIp } from "@/lib/clientIp";
import { seatLoginForbiddenResponse } from "@/lib/requireSeatLogin";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/slidingWindowRateLimit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const PREVIEW_MAX_ATTEMPTS = 10;
const PREVIEW_WINDOW_MS = 15 * 60_000;

const bodySchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  if (!session?.user?.employeeId || !session.user.companyId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rate = consumeRateLimit(
    `face-preview:${session.user.id}:${ip}`,
    PREVIEW_MAX_ATTEMPTS,
    PREVIEW_WINDOW_MS
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) {
    return NextResponse.json({ error: "PASSWORD_WRONG" }, { status: 403 });
  }

  const emp = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
    select: { facePreviewUrl: true, faceEnrolledAt: true },
  });
  if (!emp?.faceEnrolledAt) {
    return NextResponse.json({ error: "NOT_ENROLLED" }, { status: 400 });
  }
  if (!emp.facePreviewUrl) {
    return NextResponse.json({ error: "NO_PREVIEW" }, { status: 404 });
  }

  return NextResponse.json({ previewUrl: emp.facePreviewUrl });
}
