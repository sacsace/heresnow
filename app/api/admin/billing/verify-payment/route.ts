export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import {
  companyBillingSelect,
  getCompanyBillingProfile,
  snapshotBillingProfile,
} from "@/lib/companyBillingProfile";
import { allocateInvoiceNumber, ensureInvoiceNumber } from "@/lib/invoiceNumber";
import { issueEInvoiceForPaymentOrder } from "@/lib/eInvoice/issue";
import { computeCompanySubscriptionAfterPayment } from "@/lib/subscriptionPayment";
import { prisma } from "@/lib/prisma";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  paymentOrderId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "COMPANY_ADMIN" && session.user.role !== "HR_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 503 });
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

  const { paymentOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  if (
    !verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  ) {
    return NextResponse.json({ error: "결제 서명 검증에 실패했습니다." }, { status: 400 });
  }

  const order = await prisma.paymentOrder.findFirst({
    where: { id: paymentOrderId, companyId },
  });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  if (order.status === "PAID") {
    if (!order.invoiceNumber && order.paidAt) {
      await prisma.$transaction(async (tx) => {
        await ensureInvoiceNumber(tx, order.id, order.paidAt!);
      });
    }
    const eInvoice = await issueEInvoiceForPaymentOrder(order.id);
    return NextResponse.json({ ok: true, alreadyPaid: true, eInvoice });
  }
  if (order.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "주문 ID가 일치하지 않습니다." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionEndsAt: true,
      seatLimit: true,
      timezone: true,
      ...companyBillingSelect,
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const customerSnapshot = snapshotBillingProfile(getCompanyBillingProfile(company));

  const { subscriptionEndsAt: newSubscriptionEndsAt, seatLimit: newSeatLimit } =
    computeCompanySubscriptionAfterPayment({
      subscriptionEndsAt: company.subscriptionEndsAt,
      seatLimit: company.seatLimit,
      timezone: company.timezone,
      employeeCount: order.employeeCount,
      usageMonths: order.usageMonths ?? 1,
    });

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    const invoiceNumber = await allocateInvoiceNumber(tx, paidAt);

    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        razorpayPaymentId: razorpay_payment_id,
        paidAt,
        invoiceNumber,
        invoiceCustomerSnapshot: customerSnapshot,
      },
    });

    await tx.company.update({
      where: { id: companyId },
      data: {
        subscriptionEndsAt: newSubscriptionEndsAt,
        seatLimit: newSeatLimit,
        ...(order.pricingTierId ? { pricingTierId: order.pricingTierId } : {}),
      },
    });
  });

  const eInvoice = await issueEInvoiceForPaymentOrder(order.id);

  return NextResponse.json({
    ok: true,
    subscriptionEndsAt: newSubscriptionEndsAt.toISOString(),
    seatLimit: newSeatLimit,
    eInvoice,
  });
}
