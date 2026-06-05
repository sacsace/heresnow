export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { canViewBilling } from "@/lib/billingAccess";
import { getOrCreateCanonicalMonthlyTier } from "@/lib/canonicalUnitPrice";
import {
  getCompanyBillingProfile,
  isBillingProfileComplete,
  serializeBillingProfileForApi,
} from "@/lib/companyBillingProfile";
import { calculateHeadcountPayment } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { countBillableEmployees } from "@/lib/seatAccess";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewBilling(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { pricingTier: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const billingProfile = serializeBillingProfileForApi(getCompanyBillingProfile(company));

  const registeredCount = await prisma.employee.count({ where: { companyId } });
  const billableEmployeeCount = await countBillableEmployees(companyId);
  const defaultHeadcount = billableEmployeeCount;
  const defaultMonths = 1;

  const unitPriceTier = await getOrCreateCanonicalMonthlyTier(prisma);
  const defaultBill = calculateHeadcountPayment(defaultHeadcount, defaultMonths, unitPriceTier, {
    discountPercent: company.billingDiscountPercent,
    discountAmount: company.billingDiscountAmount,
  });

  return NextResponse.json({
    company: {
      name: company.name,
      seatLimit: company.seatLimit,
      subscriptionEndsAt: company.subscriptionEndsAt,
      billingDiscountPercent: company.billingDiscountPercent,
      billingDiscountAmount: company.billingDiscountAmount,
      pricingTier: unitPriceTier,
    },
    billingProfile,
    registeredCount,
    billableEmployeeCount,
    defaultHeadcount,
    defaultMonths,
    defaultBill,
    razorpayConfigured: isRazorpayConfigured(),
  });
}
