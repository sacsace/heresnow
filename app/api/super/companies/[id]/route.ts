import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToSubscriptionEndsAt, isSubscriptionDateOnly } from "@/lib/subscriptionEndsAt";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      pricingTier: {
        select: { label: true, maxSeats: true, priceAmount: true, billingPeriod: true },
      },
      _count: { select: { users: true, employees: true, attendanceRecords: true } },
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ company });
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  seatLimit: z.coerce.number().int().min(1).max(100_000).optional(),
  subscriptionEndsAt: z.union([z.string(), z.null()]).optional(),
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
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, seatLimit, subscriptionEndsAt } = parsed.data;
  if (name === undefined && seatLimit === undefined && subscriptionEndsAt === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  let ends: Date | null | undefined;
  if (subscriptionEndsAt !== undefined) {
    if (subscriptionEndsAt === null || subscriptionEndsAt === "") {
      ends = null;
    } else if (typeof subscriptionEndsAt === "string" && isSubscriptionDateOnly(subscriptionEndsAt)) {
      const row = await prisma.company.findUnique({ where: { id }, select: { timezone: true } });
      if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      try {
        ends = dateOnlyToSubscriptionEndsAt(subscriptionEndsAt, row.timezone);
      } catch {
        return NextResponse.json({ error: "Invalid subscriptionEndsAt" }, { status: 400 });
      }
    } else {
      const d = new Date(subscriptionEndsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid subscriptionEndsAt" }, { status: 400 });
      }
      ends = d;
    }
  }

  if (seatLimit !== undefined) {
    const empCount = await prisma.employee.count({ where: { companyId: id } });
    if (seatLimit < empCount) {
      return NextResponse.json(
        { error: `좌석 상한은 직원 수(${empCount}) 이상이어야 합니다.` },
        { status: 400 }
      );
    }
  }

  try {
    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(seatLimit !== undefined ? { seatLimit } : {}),
        ...(ends !== undefined ? { subscriptionEndsAt: ends } : {}),
      },
      include: {
        pricingTier: {
        select: { label: true, maxSeats: true, priceAmount: true, billingPeriod: true },
      },
        _count: { select: { users: true, employees: true, attendanceRecords: true } },
      },
    });
    return NextResponse.json({ company });
  } catch {
    return NextResponse.json({ error: "회사를 찾을 수 없거나 저장할 수 없습니다." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.company.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
