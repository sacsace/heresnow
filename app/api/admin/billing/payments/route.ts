export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { canViewBilling } from "@/lib/billingAccess";
import { serializePaymentOrder } from "@/lib/billingInvoice";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !canViewBilling(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const orders = await prisma.paymentOrder.findMany({
    where: { companyId, status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    payments: orders.map((o) => serializePaymentOrder(o)),
  });
}
