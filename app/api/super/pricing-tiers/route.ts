import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tiers = await prisma.pricingTier.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ tiers });
  } catch (e) {
    console.error("[api/super/pricing-tiers GET]", e);
    return NextResponse.json(
      { error: "DB 조회 실패. 마이그레이션(prisma migrate)과 DATABASE_URL을 확인하세요.", tiers: [] },
      { status: 500 }
    );
  }
}

const patchSchema = z.object({
  tiers: z.array(
    z.object({
      id: z.string().min(1),
      pricePerYear: z.coerce.number().int().min(0).optional(),
      label: z.string().max(100).nullable().optional(),
      minSeats: z.coerce.number().int().min(1).optional(),
      maxSeats: z.coerce.number().int().min(1).optional(),
      sortOrder: z.coerce.number().int().optional(),
      trialDays: z.union([z.number().int().min(0).max(366), z.null()]).optional(),
    })
  ),
});

export async function PATCH(req: Request) {
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
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const row of parsed.data.tiers) {
    const data: Record<string, unknown> = {};
    if (row.pricePerYear !== undefined) data.pricePerYear = row.pricePerYear;
    if (row.label !== undefined) data.label = row.label;
    if (row.minSeats !== undefined) data.minSeats = row.minSeats;
    if (row.maxSeats !== undefined) data.maxSeats = row.maxSeats;
    if (row.sortOrder !== undefined) data.sortOrder = row.sortOrder;
    if (row.trialDays !== undefined) data.trialDays = row.trialDays;
    if (Object.keys(data).length === 0) continue;
    try {
      await prisma.pricingTier.update({ where: { id: row.id }, data });
    } catch {
      return NextResponse.json({ error: `티어 업데이트 실패: ${row.id}` }, { status: 400 });
    }
  }

  const tiers = await prisma.pricingTier.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ tiers });
}
