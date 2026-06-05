import { getInvoiceVendor } from "@/lib/invoiceVendor";

export type GstBreakdown = {
  gstRatePercent: number;
  supplierState: string;
  customerState: string;
  isIntraState: boolean;
  taxableAmount: number;
  taxableAmountPaise: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  gstTotal: number;
  grandTotal: number;
  grandTotalPaise: number;
  halfRatePercent: number;
};

export function getGstRatePercent(): number {
  const raw = process.env.INVOICE_GST_RATE_PERCENT?.trim();
  const n = raw ? parseInt(raw, 10) : 18;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 18;
}

/** Normalize state names for comparison (Karnataka / KA / etc.). */
export function normalizeIndianState(state: string | null | undefined): string {
  const s = state?.trim().toLowerCase() ?? "";
  if (!s) return "";
  const aliases: Record<string, string> = {
    ka: "karnataka",
    karnataka: "karnataka",
    kar: "karnataka",
  };
  return aliases[s] ?? s.replace(/\s+/g, " ");
}

export function getSupplierState(): string {
  const vendor = getInvoiceVendor();
  return vendor.state.trim() || "Karnataka";
}

/** Same state → CGST + SGST; different state → IGST. */
export function isIntraStateSupply(supplierState: string, customerState: string): boolean {
  const supplier = normalizeIndianState(supplierState);
  const customer = normalizeIndianState(customerState);
  if (!supplier || !customer) return false;
  return supplier === customer;
}

function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function calculateGstBreakdown(
  taxableAmountRupees: number,
  customerState: string,
  supplierState?: string
): GstBreakdown {
  const supplier = supplierState?.trim() || getSupplierState();
  const customer = customerState.trim();
  const gstRatePercent = getGstRatePercent();
  const taxableAmountPaise = rupeesToPaise(Math.max(0, taxableAmountRupees));
  const isIntraState = isIntraStateSupply(supplier, customer);
  const halfRatePercent = gstRatePercent / 2;

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (isIntraState) {
    cgstPaise = Math.round((taxableAmountPaise * halfRatePercent) / 100);
    sgstPaise = Math.round((taxableAmountPaise * halfRatePercent) / 100);
  } else {
    igstPaise = Math.round((taxableAmountPaise * gstRatePercent) / 100);
  }

  const gstTotalPaise = cgstPaise + sgstPaise + igstPaise;
  const grandTotalPaise = taxableAmountPaise + gstTotalPaise;

  return {
    gstRatePercent,
    supplierState: supplier,
    customerState: customer,
    isIntraState,
    taxableAmount: paiseToRupees(taxableAmountPaise),
    taxableAmountPaise,
    cgstAmount: paiseToRupees(cgstPaise),
    sgstAmount: paiseToRupees(sgstPaise),
    igstAmount: paiseToRupees(igstPaise),
    cgstPaise,
    sgstPaise,
    igstPaise,
    gstTotal: paiseToRupees(gstTotalPaise),
    grandTotal: paiseToRupees(grandTotalPaise),
    grandTotalPaise,
    halfRatePercent,
  };
}

export function resolveOrderGst(order: {
  amountPaise: number;
  discountTotal: number;
  taxableAmountPaise?: number | null;
  cgstPaise?: number | null;
  sgstPaise?: number | null;
  igstPaise?: number | null;
  gstRatePercent?: number | null;
  supplierState?: string | null;
  customerState?: string | null;
}): GstBreakdown & { grossSubtotal: number } {
  if (order.taxableAmountPaise != null && order.taxableAmountPaise > 0) {
    const taxableAmountPaise = order.taxableAmountPaise;
    const cgstPaise = order.cgstPaise ?? 0;
    const sgstPaise = order.sgstPaise ?? 0;
    const igstPaise = order.igstPaise ?? 0;
    const gstTotalPaise = cgstPaise + sgstPaise + igstPaise;
    const gstRatePercent = order.gstRatePercent ?? getGstRatePercent();
    const supplier = order.supplierState ?? getSupplierState();
    const customer = order.customerState ?? "";
    const isIntraState = cgstPaise + sgstPaise > 0;

    return {
      gstRatePercent,
      supplierState: supplier,
      customerState: customer,
      isIntraState,
      taxableAmount: paiseToRupees(taxableAmountPaise),
      taxableAmountPaise,
      cgstAmount: paiseToRupees(cgstPaise),
      sgstAmount: paiseToRupees(sgstPaise),
      igstAmount: paiseToRupees(igstPaise),
      cgstPaise,
      sgstPaise,
      igstPaise,
      gstTotal: paiseToRupees(gstTotalPaise),
      grandTotal: paiseToRupees(order.amountPaise),
      grandTotalPaise: order.amountPaise,
      halfRatePercent: gstRatePercent / 2,
      grossSubtotal: paiseToRupees(taxableAmountPaise) + order.discountTotal,
    };
  }

  // Legacy orders (pre-GST): treat charged amount as taxable, no GST lines
  const grandTotal = paiseToRupees(order.amountPaise);
  const taxable = grandTotal;
  return {
    gstRatePercent: getGstRatePercent(),
    supplierState: getSupplierState(),
    customerState: order.customerState ?? "",
    isIntraState: false,
    taxableAmount: taxable,
    taxableAmountPaise: order.amountPaise,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    gstTotal: 0,
    grandTotal,
    grandTotalPaise: order.amountPaise,
    halfRatePercent: getGstRatePercent() / 2,
    grossSubtotal: taxable + order.discountTotal,
  };
}

export function formatGstSummaryLines(
  gst: GstBreakdown,
  locale: "ko" | "en" = "en"
): string[] {
  if (gst.gstTotal <= 0) return [];

  const lines: string[] = [];
  if (gst.isIntraState) {
    lines.push(
      locale === "en"
        ? `CGST @ ${gst.halfRatePercent}%: Rs.${gst.cgstAmount}`
        : `CGST ${gst.halfRatePercent}%: Rs.${gst.cgstAmount}`
    );
    lines.push(
      locale === "en"
        ? `SGST @ ${gst.halfRatePercent}%: Rs.${gst.sgstAmount}`
        : `SGST ${gst.halfRatePercent}%: Rs.${gst.sgstAmount}`
    );
  } else {
    lines.push(
      locale === "en"
        ? `IGST @ ${gst.gstRatePercent}%: Rs.${gst.igstAmount}`
        : `IGST ${gst.gstRatePercent}%: Rs.${gst.igstAmount}`
    );
  }
  return lines;
}
