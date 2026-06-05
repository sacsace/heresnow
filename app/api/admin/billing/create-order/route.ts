export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getOrCreateCanonicalMonthlyTier } from "@/lib/canonicalUnitPrice";
import {
  companyBillingSelect,
  getCompanyBillingProfile,
  isBillingProfileComplete,
} from "@/lib/companyBillingProfile";
import { calculateHeadcountPayment } from "@/lib/pricing";
import { calculateGstBreakdown } from "@/lib/gst";
import { prisma } from "@/lib/prisma";
import { countBillableEmployees } from "@/lib/seatAccess";
import {
  getPublicRazorpayKeyId,
  getRazorpayClient,
  isRazorpayConfigured,
} from "@/lib/razorpay";
import { PaymentPurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  employeeCount: z.number().int().min(1).max(100_000),
  months: z.number().int().min(1).max(120).default(1),
});

function assertBillingRole(role: string | undefined) {
  return role === "COMPANY_ADMIN" || role === "HR_MANAGER";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !assertBillingRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Razorpay가 설정되지 않았습니다. RAZORPAY_KEY_ID 등 환경 변수를 확인하세요." },
      { status: 503 }
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      ...companyBillingSelect,
      billingDiscountPercent: true,
      billingDiscountAmount: true,
      pricingTier: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const billingProfile = getCompanyBillingProfile(company);
  if (!isBillingProfileComplete(billingProfile)) {
    return NextResponse.json(
      {
        error: "Complete billing details on the payment page before paying.",
        code: "BILLING_PROFILE_INCOMPLETE",
      },
      { status: 400 }
    );
  }

  const unitPriceTier = await getOrCreateCanonicalMonthlyTier(prisma);
  const { employeeCount: headcount, months } = parsed.data;

  const billableEmployeeCount = await countBillableEmployees(companyId);
  if (headcount < billableEmployeeCount) {
    return NextResponse.json(
      {
        error: `Pay for at least ${billableEmployeeCount} billable user(s) (admins excluded).`,
        code: "HEADCOUNT_BELOW_REGISTERED",
        billableEmployeeCount,
      },
      { status: 400 }
    );
  }

  const bill = calculateHeadcountPayment(headcount, months, unitPriceTier, {
    discountPercent: company.billingDiscountPercent,
    discountAmount: company.billingDiscountAmount,
  });
  if (!bill) {
    return NextResponse.json({ error: "결제할 금액을 계산할 수 없습니다." }, { status: 400 });
  }

  if (bill.total <= 0) {
    return NextResponse.json({ error: "결제할 금액이 없습니다." }, { status: 400 });
  }

  const gst = calculateGstBreakdown(bill.total, billingProfile.state);
  const amountPaise = gst.grandTotalPaise;
  const receipt = `${companyId.slice(0, 8)}-${Date.now()}`;

  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: bill.currency,
    receipt,
    notes: {
      companyId,
      employeeCount: String(headcount),
      months: String(bill.months),
    },
  });

  const paymentOrder = await prisma.paymentOrder.create({
    data: {
      companyId,
      purpose: PaymentPurpose.SUBSCRIPTION_RENEWAL,
      amountPaise,
      currency: bill.currency,
      employeeCount: bill.employeeCount,
      pricePerUser: bill.pricePerUser,
      discountTotal: bill.discountTotal,
      billingPeriod: "MONTHLY",
      usageMonths: bill.months,
      pricingTierId: unitPriceTier.id,
      targetTierId: null,
      razorpayOrderId: order.id,
      status: "CREATED",
      taxableAmountPaise: gst.taxableAmountPaise,
      cgstPaise: gst.cgstPaise,
      sgstPaise: gst.sgstPaise,
      igstPaise: gst.igstPaise,
      gstRatePercent: gst.gstRatePercent,
      supplierState: gst.supplierState,
      customerState: gst.customerState,
    },
  });

  return NextResponse.json({
    orderId: order.id,
    amountPaise,
    currency: bill.currency,
    keyId: getPublicRazorpayKeyId(),
    paymentOrderId: paymentOrder.id,
    bill,
    gst,
    companyName: company.name,
  });
}
