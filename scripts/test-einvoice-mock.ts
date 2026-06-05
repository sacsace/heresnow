/**
 * E-Invoice mock smoke test — npx tsx --env-file=.env scripts/test-einvoice-mock.ts
 */
import { buildNicEInvoicePayload } from "../lib/eInvoice/buildPayload";
import { isEInvoiceConfigured, isEInvoiceEnabled, isEInvoiceMockMode } from "../lib/eInvoice/config";
import { submitNicEInvoice } from "../lib/eInvoice/submit";
import type { PaymentOrder } from "@prisma/client";

const mockOrder = {
  id: "test_einvoice_order_001",
  companyId: "test_co",
  purpose: "SUBSCRIPTION_RENEWAL",
  amountPaise: 26550,
  currency: "INR",
  employeeCount: 1,
  pricePerUser: 250,
  discountTotal: 25,
  billingPeriod: "MONTHLY",
  usageMonths: 1,
  pricingTierId: null,
  targetTierId: null,
  razorpayOrderId: null,
  razorpayPaymentId: "pay_test_mock",
  status: "PAID",
  paidAt: new Date(),
  invoiceCustomerSnapshot: {
    legalName: "Minsub Ventures Private Limited",
    address: "24/1, Doddanekundi, Ferns City Road, Outer Ring Road, Marathahalli",
    city: "Bangalore",
    state: "Karnataka",
    postalCode: "562149",
    country: "India",
    gstin: "29AANCM3695F1ZW",
    email: "info@msventures.in",
    phone: "09789888485",
  },
  taxableAmountPaise: 22500,
  cgstPaise: 2025,
  sgstPaise: 2025,
  igstPaise: 0,
  gstRatePercent: 18,
  supplierState: "Karnataka",
  customerState: "Karnataka",
  eInvoiceStatus: "SKIPPED",
  eInvoiceIrn: null,
  eInvoiceAckNo: null,
  eInvoiceAckAt: null,
  eInvoiceSignedQrCode: null,
  eInvoiceLastError: null,
  invoiceNumber: "HN/2627/00001",
  createdAt: new Date(),
} satisfies PaymentOrder;

const customer = {
  legalName: "Minsub Ventures Private Limited",
  address: "24/1, Doddanekundi, Ferns City Road, Outer Ring Road, Marathahalli",
  city: "Bangalore",
  state: "Karnataka",
  postalCode: "562149",
  country: "India",
  gstin: "29AANCM3695F1ZW",
  email: "info@msventures.in",
  phone: "09789888485",
};

async function main() {
  console.log("EINVOICE_ENABLED:", isEInvoiceEnabled());
  console.log("EINVOICE_MOCK:", isEInvoiceMockMode());
  console.log("isEInvoiceConfigured:", isEInvoiceConfigured());

  if (!isEInvoiceConfigured()) {
    console.error("FAIL — set EINVOICE_ENABLED=true and EINVOICE_MOCK=1 in .env");
    process.exit(1);
  }

  const payload = buildNicEInvoicePayload(mockOrder, customer);
  console.log("\nNIC payload DocDtls:", payload.DocDtls);
  console.log("ValDtls:", payload.ValDtls);

  const result = await submitNicEInvoice(payload);
  console.log("\nMock IRN result:");
  console.log("  IRN:", result.irn);
  console.log("  AckNo:", result.ackNo);
  console.log("  SignedQRCode:", result.signedQrCode.slice(0, 60) + "…");
  console.log("\nOK — mock e-Invoice flow works.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
