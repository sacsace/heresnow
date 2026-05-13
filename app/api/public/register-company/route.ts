import { prisma } from "@/lib/prisma";
import { addDays, addYears } from "@/lib/pricing";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const ALLOWED_SIGNUP_TIMEZONE = "Asia/Kolkata" as const;

const bodySchema = z.object({
  companyName: z.string().min(1).max(200),
  timezone: z.literal(ALLOWED_SIGNUP_TIMEZONE),
  adminEmail: z.string().email().transform((e) => e.toLowerCase().trim()),
  adminPassword: z.string().min(8).max(200),
  pricingTierId: z.string().min(1),
  adminName: z.string().min(1).max(120).optional(),
});

export async function POST(req: Request) {
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

  const { companyName, timezone, adminEmail, adminPassword, pricingTierId, adminName } = parsed.data;
  const displayName = (adminName?.trim() || adminEmail.split("@")[0] || "관리자").slice(0, 120);

  const tier = await prisma.pricingTier.findUnique({ where: { id: pricingTierId } });
  if (!tier) {
    return NextResponse.json({ error: "유효하지 않은 요금제입니다." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (exists) {
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const subscriptionEndsAt =
    tier.trialDays != null && tier.trialDays > 0
      ? addDays(new Date(), tier.trialDays)
      : addYears(new Date(), 1);

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName.trim(),
          timezone: timezone.trim(),
          pricingTierId: tier.id,
          seatLimit: tier.maxSeats,
          subscriptionEndsAt,
        },
      });
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: adminEmail,
          passwordHash,
          role: Role.COMPANY_ADMIN,
          consentGivenAt: null,
          consentVersion: null,
        },
      });
      await tx.employee.create({
        data: {
          companyId: company.id,
          userId: user.id,
          name: displayName,
        },
      });
    });
  } catch (e) {
    console.error("[register-company]", e);
    return NextResponse.json({ error: "가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
