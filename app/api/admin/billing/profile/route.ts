export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { canPayBilling, canViewBilling } from "@/lib/billingAccess";
import {
  companyBillingSelect,
  getCompanyBillingProfile,
  serializeBillingProfileForApi,
} from "@/lib/companyBillingProfile";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(400),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100).default("India"),
  gstin: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).nullable().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !canViewBilling(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const companyId = session.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "No company" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: companyBillingSelect,
    });
    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const profile = getCompanyBillingProfile(company);
    return NextResponse.json({
      billingProfile: serializeBillingProfileForApi(profile),
      canEdit: canPayBilling(session),
    });
  } catch (e) {
    console.error("[admin/billing/profile GET]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json(
      {
        error:
          message.includes("Unknown field") || message.includes("does not exist")
            ? "DB 스키마가 최신이 아닙니다. 서버를 중지한 뒤 npx prisma migrate deploy && npx prisma generate 후 다시 실행해 주세요."
            : `인보이스 정보 조회 실패: ${message}`,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !canPayBilling(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
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

  const d = parsed.data;
  try {
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        billingLegalName: d.legalName,
        billingAddressLine1: d.address,
        billingAddressLine2: null,
        billingCity: d.city,
        billingState: d.state,
        billingPostalCode: d.postalCode,
        billingCountry: d.country,
        billingGstin: d.gstin?.trim() || null,
        billingEmail: d.email,
        billingPhone: d.phone?.trim() || null,
      },
      select: companyBillingSelect,
    });

    const profile = getCompanyBillingProfile(company);
    return NextResponse.json({
      billingProfile: serializeBillingProfileForApi(profile),
      canEdit: true,
    });
  } catch (e) {
    console.error("[admin/billing/profile PATCH]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json(
      {
        error:
          message.includes("Unknown field") ||
          message.includes("Unknown argument") ||
          message.includes("does not exist")
            ? "DB 스키마가 최신이 아닙니다. 서버를 중지한 뒤 npx prisma migrate deploy && npx prisma generate 후 다시 실행해 주세요."
            : `인보이스 정보 저장 실패: ${message}`,
      },
      { status: 500 }
    );
  }
}
