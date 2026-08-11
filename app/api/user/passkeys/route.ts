import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DeleteBody = z.object({
  id: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const credentials = await prisma.userPasskeyCredential.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      deviceType: true,
      transports: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({
    credentials: credentials.map((item) => ({
      id: item.id,
      nickname: item.nickname,
      deviceType: item.deviceType,
      transports: item.transports,
      createdAt: item.createdAt.toISOString(),
      lastUsedAt: item.lastUsedAt ? item.lastUsedAt.toISOString() : null,
    })),
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = DeleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const deleted = await prisma.userPasskeyCredential.deleteMany({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

