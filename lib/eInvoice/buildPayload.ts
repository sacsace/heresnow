import type { PaymentOrder } from "@prisma/client";
import { resolveInvoiceNumber } from "@/lib/invoiceNumber";
import {
  parseInvoiceCustomerSnapshot,
  type CompanyBillingProfile,
} from "@/lib/companyBillingProfile";
import { parsePinCode, resolveGstStateCode } from "@/lib/eInvoice/stateCodes";
import { resolveOrderGst } from "@/lib/gst";
import { getInvoiceVendor } from "@/lib/invoiceVendor";

/** NIC GST e-Invoice schema v1.1 (simplified B2B service invoice). */
export type NicEInvoicePayload = {
  Version: "1.1";
  TranDtls: {
    TaxSch: "GST";
    SupTyp: "B2B";
    RegRev: "N";
    IgstOnIntra: "N";
  };
  DocDtls: {
    Typ: "INV";
    No: string;
    Dt: string;
  };
  SellerDtls: {
    Gstin: string;
    LglNm: string;
    Addr1: string;
    Loc: string;
    Pin: number;
    Stcd: string;
  };
  BuyerDtls: {
    Gstin: string;
    LglNm: string;
    Addr1: string;
    Loc: string;
    Pin: number;
    Pos: string;
    Stcd: string;
  };
  ItemList: Array<{
    SlNo: string;
    PrdDesc: string;
    IsServc: "Y";
    HsnCd: string;
    Qty: number;
    Unit: "OTH";
    UnitPrice: number;
    TotAmt: number;
    AssAmt: number;
    GstRt: number;
    CgstAmt: number;
    SgstAmt: number;
    IgstAmt: number;
    TotItemVal: number;
  }>;
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    TotInvVal: number;
  };
};

function formatNicDate(paidAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(paidAt);
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  return `${d}/${m}/${y}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildNicEInvoicePayload(
  order: PaymentOrder,
  customer: CompanyBillingProfile
): NicEInvoicePayload {
  const vendor = getInvoiceVendor();
  const paidAt = order.paidAt ?? new Date();
  const gst = resolveOrderGst(order);
  const invoiceNo = resolveInvoiceNumber(order);
  const months = order.usageMonths ?? 1;

  const sellerGstin = vendor.gstin?.trim().toUpperCase() ?? "";
  const buyerGstin = customer.gstin?.trim().toUpperCase() ?? "";
  const sellerStcd = resolveGstStateCode(sellerGstin, vendor.state);
  const buyerStcd = resolveGstStateCode(buyerGstin, customer.state);

  const taxable = round2(gst.taxableAmount);
  const cgst = round2(gst.cgstAmount);
  const sgst = round2(gst.sgstAmount);
  const igst = round2(gst.igstAmount);
  const total = round2(gst.grandTotal);

  const sellerAddr = vendor.addressLine1.trim() || vendor.city.trim() || "India";
  const buyerAddr = customer.address.trim() || customer.city.trim() || "India";

  const lineTotal = round2(order.employeeCount * order.pricePerUser * months);

  return {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: "B2B",
      RegRev: "N",
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: "INV",
      No: invoiceNo,
      Dt: formatNicDate(paidAt),
    },
    SellerDtls: {
      Gstin: sellerGstin,
      LglNm: vendor.legalName,
      Addr1: sellerAddr.slice(0, 100),
      Loc: vendor.city.trim() || vendor.state.trim() || "Bangalore",
      Pin: parsePinCode(vendor.postalCode),
      Stcd: sellerStcd,
    },
    BuyerDtls: {
      Gstin: buyerGstin,
      LglNm: customer.legalName,
      Addr1: buyerAddr.slice(0, 100),
      Loc: customer.city.trim() || customer.state.trim() || "India",
      Pin: parsePinCode(customer.postalCode),
      Pos: buyerStcd,
      Stcd: buyerStcd,
    },
    ItemList: [
      {
        SlNo: "1",
        PrdDesc: `HeresNow subscription — ${order.employeeCount} seat(s) × ${months} month(s)`,
        IsServc: "Y",
        HsnCd: "998313",
        Qty: 1,
        Unit: "OTH",
        UnitPrice: taxable,
        TotAmt: lineTotal >= taxable ? lineTotal : taxable,
        AssAmt: taxable,
        GstRt: gst.gstRatePercent,
        CgstAmt: cgst,
        SgstAmt: sgst,
        IgstAmt: igst,
        TotItemVal: total,
      },
    ],
    ValDtls: {
      AssVal: taxable,
      CgstVal: cgst,
      SgstVal: sgst,
      IgstVal: igst,
      TotInvVal: total,
    },
  };
}

export function resolveCustomerForEInvoice(order: PaymentOrder): CompanyBillingProfile | null {
  return parseInvoiceCustomerSnapshot(order.invoiceCustomerSnapshot);
}
