import { auth } from "@/auth";
import { canPayBilling } from "@/lib/billingAccess";
import { issueEInvoiceForPaymentOrder } from "@/lib/eInvoice/issue";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !canPayBilling(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const order = await prisma.paymentOrder.findFirst({
    where: { id, companyId, status: "PAID" },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await issueEInvoiceForPaymentOrder(order.id);
  return NextResponse.json({ ok: true, eInvoice: result });
}
