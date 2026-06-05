export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BillingPeriod } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const periodFilter =
      periodParam === "MONTHLY" || periodParam === "YEARLY"
        ? (periodParam as BillingPeriod)
        : undefined;

    const tiers = await prisma.pricingTier.findMany({
      where: periodFilter ? { billingPeriod: periodFilter } : undefined,
      orderBy: [{ billingPeriod: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ tiers });
  } catch (e) {
    console.error("[api/super/pricing-tiers GET]", e);
    return NextResponse.json(
      { error: "DB 조회 실패. 마이그레이션(prisma migrate)과 DATABASE_URL을 확인하세요.", tiers: [] },
      { status: 500 }
    );
  }
}

const tierRowSchema = z.object({
  id: z.string().min(1).optional(),
  billingPeriod: z.enum(["MONTHLY", "YEARLY"]).optional(),
  priceAmount: z.coerce.number().int().min(0).optional(),
  pricePerUser: z.coerce.number().int().min(0).optional(),
  label: z.string().max(100).nullable().optional(),
  minSeats: z.coerce.number().int().min(1).optional(),
  maxSeats: z.coerce.number().int().min(1).optional(),
  sortOrder: z.coerce.number().int().optional(),
  trialDays: z.union([z.number().int().min(0).max(366), z.null()]).optional(),
});

const patchSchema = z.object({
  tiers: z.array(tierRowSchema.extend({ id: z.string().min(1) })),
});

const postSchema = z.object({
  billingPeriod: z.enum(["MONTHLY", "YEARLY"]),
  minSeats: z.coerce.number().int().min(1),
  maxSeats: z.coerce.number().int().min(1),
  priceAmount: z.coerce.number().int().min(0),
  pricePerUser: z.coerce.number().int().min(0).optional(),
  label: z.string().max(100).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  trialDays: z.union([z.number().int().min(0).max(366), z.null()]).optional(),
});

export async function POST(req: Request) {
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
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.minSeats > parsed.data.maxSeats) {
    return NextResponse.json({ error: "최소 사용자 수가 최대 사용자 수보다 클 수 없습니다." }, { status: 400 });
  }

  try {
    const pricePerUser =
      parsed.data.pricePerUser ??
      (parsed.data.maxSeats > 0
        ? Math.round(parsed.data.priceAmount / parsed.data.maxSeats)
        : parsed.data.priceAmount);
    const priceAmount = pricePerUser * parsed.data.maxSeats;
    const tier = await prisma.pricingTier.create({
      data: {
        billingPeriod: parsed.data.billingPeriod,
        minSeats: parsed.data.minSeats,
        maxSeats: parsed.data.maxSeats,
        priceAmount,
        pricePerUser,
        label: parsed.data.label ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        trialDays:
          parsed.data.trialDays != null && parsed.data.trialDays > 0
            ? parsed.data.trialDays
            : null,
      },
    });
    return NextResponse.json({ tier }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "동일 사용자 수 구간·결제 주기(월/연) 조합이 이미 있습니다." },
      { status: 409 }
    );
  }
}

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
    if (row.priceAmount !== undefined) data.priceAmount = row.priceAmount;
    if (row.pricePerUser !== undefined) data.pricePerUser = row.pricePerUser;
    if (row.label !== undefined) data.label = row.label;
    if (row.minSeats !== undefined) data.minSeats = row.minSeats;
    if (row.maxSeats !== undefined) data.maxSeats = row.maxSeats;
    if (row.sortOrder !== undefined) data.sortOrder = row.sortOrder;
    if (row.trialDays !== undefined) data.trialDays = row.trialDays;
    if (row.billingPeriod !== undefined) data.billingPeriod = row.billingPeriod;
    if (Object.keys(data).length === 0) continue;
    try {
      await prisma.pricingTier.update({ where: { id: row.id }, data });
    } catch {
      return NextResponse.json({ error: `티어 업데이트 실패: ${row.id}` }, { status: 400 });
    }
  }

  const tiers = await prisma.pricingTier.findMany({
    orderBy: [{ billingPeriod: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ tiers });
}
