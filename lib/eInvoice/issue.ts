import { ensureInvoiceNumber } from "@/lib/invoiceNumber";
import { buildNicEInvoicePayload, resolveCustomerForEInvoice } from "@/lib/eInvoice/buildPayload";
import { isEInvoiceConfigured, isEInvoiceEnabled } from "@/lib/eInvoice/config";
import { submitNicEInvoice } from "@/lib/eInvoice/submit";
import { getInvoiceVendor } from "@/lib/invoiceVendor";
import { prisma } from "@/lib/prisma";

export type IssueEInvoiceOutcome =
  | { status: "SKIPPED"; reason: string }
  | { status: "ISSUED"; irn: string }
  | { status: "FAILED"; error: string }
  | { status: "ALREADY_ISSUED"; irn: string };

function isValidGstin(gstin: string | null | undefined): boolean {
  const g = gstin?.trim().toUpperCase() ?? "";
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g);
}

export async function issueEInvoiceForPaymentOrder(
  paymentOrderId: string
): Promise<IssueEInvoiceOutcome> {
  let order = await prisma.paymentOrder.findUnique({ where: { id: paymentOrderId } });
  if (!order || order.status !== "PAID" || !order.paidAt) {
    return { status: "SKIPPED", reason: "Payment not completed" };
  }

  if (!order.invoiceNumber) {
    await prisma.$transaction(async (tx) => {
      await ensureInvoiceNumber(tx, order!.id, order!.paidAt!);
    });
    order = await prisma.paymentOrder.findUnique({ where: { id: paymentOrderId } });
    if (!order) {
      return { status: "FAILED", error: "Payment order not found" };
    }
  }

  if (order.eInvoiceStatus === "ISSUED" && order.eInvoiceIrn) {
    return { status: "ALREADY_ISSUED", irn: order.eInvoiceIrn };
  }

  if (!isEInvoiceEnabled()) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { eInvoiceStatus: "SKIPPED", eInvoiceLastError: "E-Invoice disabled" },
    });
    return { status: "SKIPPED", reason: "E-Invoice disabled" };
  }

  if (!isEInvoiceConfigured()) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        eInvoiceStatus: "FAILED",
        eInvoiceLastError: "GSP not configured. Set EINVOICE_GSP_API_URL and EINVOICE_GSP_AUTH_TOKEN.",
      },
    });
    return { status: "FAILED", error: "GSP not configured" };
  }

  const customer = resolveCustomerForEInvoice(order);
  if (!customer) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { eInvoiceStatus: "FAILED", eInvoiceLastError: "Missing customer billing snapshot" },
    });
    return { status: "FAILED", error: "Missing customer billing snapshot" };
  }

  const vendor = getInvoiceVendor();
  if (!isValidGstin(vendor.gstin)) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        eInvoiceStatus: "FAILED",
        eInvoiceLastError: "Supplier GSTIN (INVOICE_VENDOR_GSTIN) is required for e-Invoice",
      },
    });
    return { status: "FAILED", error: "Supplier GSTIN missing" };
  }

  if (!isValidGstin(customer.gstin)) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        eInvoiceStatus: "FAILED",
        eInvoiceLastError: "Buyer GSTIN is required for B2B e-Invoice. Add it in invoice details.",
      },
    });
    return { status: "FAILED", error: "Buyer GSTIN missing" };
  }

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { eInvoiceStatus: "PENDING", eInvoiceLastError: null },
  });

  try {
    const payload = buildNicEInvoicePayload(order, customer);
    const result = await submitNicEInvoice(payload);

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        eInvoiceStatus: "ISSUED",
        eInvoiceIrn: result.irn,
        eInvoiceAckNo: result.ackNo || null,
        eInvoiceAckAt: result.ackAt,
        eInvoiceSignedQrCode: result.signedQrCode,
        eInvoiceLastError: null,
      },
    });

    return { status: "ISSUED", irn: result.irn };
  } catch (e) {
    const message = e instanceof Error ? e.message : "e-Invoice submission failed";
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        eInvoiceStatus: "FAILED",
        eInvoiceLastError: message.slice(0, 500),
      },
    });
    return { status: "FAILED", error: message };
  }
}
