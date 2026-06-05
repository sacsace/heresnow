export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getOrCreateCanonicalMonthlyTier, saveCanonicalUnitPrice } from "@/lib/canonicalUnitPrice";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tier = await getOrCreateCanonicalMonthlyTier(prisma);
    return NextResponse.json({
      pricePerUser: tier.pricePerUser,
      currency: tier.currency,
      id: tier.id,
    });
  } catch (e) {
    console.error("[api/super/unit-price GET]", e);
    return NextResponse.json({ error: "DB 조회 실패" }, { status: 500 });
  }
}

const putSchema = z.object({
  pricePerUser: z.coerce.number().int().min(0),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const tier = await saveCanonicalUnitPrice(prisma, parsed.data.pricePerUser);
    return NextResponse.json({
      pricePerUser: tier.pricePerUser,
      currency: tier.currency,
      id: tier.id,
    });
  } catch (e) {
    console.error("[api/super/unit-price PUT]", e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
