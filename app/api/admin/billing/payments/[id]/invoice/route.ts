import { auth } from "@/auth";
import { canViewBilling } from "@/lib/billingAccess";
import { formatInvoiceFilename } from "@/lib/billingInvoice";
import { buildInvoicePdf } from "@/lib/billingInvoicePdf";
import {
  companyBillingSelect,
  resolveInvoiceCustomer,
} from "@/lib/companyBillingProfile";
import { ensureInvoiceNumber } from "@/lib/invoiceNumber";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !canViewBilling(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const { id } = await ctx.params;

  let order = await prisma.paymentOrder.findFirst({
    where: { id, companyId, status: "PAID" },
  });
  if (!order || !order.paidAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!order.invoiceNumber) {
    await prisma.$transaction(async (tx) => {
      await ensureInvoiceNumber(tx, order!.id, order!.paidAt!);
    });
    order = await prisma.paymentOrder.findFirst({
      where: { id, companyId, status: "PAID" },
    });
    if (!order || !order.paidAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: companyBillingSelect,
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const customer = resolveInvoiceCustomer(order, company);
    const pdfBuffer = await buildInvoicePdf(order, customer);
    const filename = formatInvoiceFilename(order.paidAt);
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[admin/billing/payments/invoice GET]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: `Invoice PDF failed: ${message}` }, { status: 500 });
  }
}
