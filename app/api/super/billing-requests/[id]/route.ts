export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { subscriptionEndsAtForTier } from "@/lib/pricing";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const br = await prisma.billingRequest.findUnique({
    where: { id },
    include: { company: true, targetTier: true },
  });
  if (!br) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (br.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 400 });
  }

  if (parsed.data.status === "REJECTED") {
    await prisma.billingRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolverUserId: session.user.id,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: br.companyId },
      data: {
        pricingTierId: br.targetTierId,
        seatLimit: br.targetTier.maxSeats,
        subscriptionEndsAt: subscriptionEndsAtForTier(br.targetTier),
      },
    });
    await tx.billingRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolverUserId: session.user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
