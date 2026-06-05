import type { PaymentOrder } from "@prisma/client";
import {
  formatBillingAddressBlock,
  type CompanyBillingProfile,
} from "@/lib/companyBillingProfile";
import { resolveOrderGst } from "@/lib/gst";
import {
  formatInvoiceDateYmd,
  resolveInvoiceNumber,
} from "@/lib/invoiceNumber";
import { formatVendorAddressLines, getInvoiceVendor } from "@/lib/invoiceVendor";

const INVOICE_FILENAME_SUFFIX = "_RI (Minsub Ventures) (HeresNow).pdf";

export { formatInvoiceDateYmd } from "@/lib/invoiceNumber";

export function formatInvoiceFilename(paidAt: Date): string {
  return `${formatInvoiceDateYmd(paidAt)}${INVOICE_FILENAME_SUFFIX}`;
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function renderPartyBlock(
  title: string,
  name: string,
  addressLines: string[],
  extras: { label: string; value: string }[]
): string {
  const addrHtml = addressLines
    .filter(Boolean)
    .map((line) => `<div class="party-line">${escapeHtml(line)}</div>`)
    .join("");
  const extrasHtml = extras
    .filter((e) => e.value)
    .map(
      (e) =>
        `<div class="party-meta-row"><span class="party-meta-label">${escapeHtml(e.label)}</span><span class="party-meta-value">${escapeHtml(e.value)}</span></div>`
    )
    .join("");

  return `
    <section class="party-card">
      <div class="party-eyebrow">${escapeHtml(title)}</div>
      <div class="party-name">${escapeHtml(name)}</div>
      <div class="party-address">${addrHtml || '<div class="party-line">—</div>'}</div>
      ${extrasHtml ? `<div class="party-meta">${extrasHtml}</div>` : ""}
    </section>`;
}

export function buildInvoiceHtml(
  order: Pick<
    PaymentOrder,
    | "id"
    | "paidAt"
    | "employeeCount"
    | "pricePerUser"
    | "discountTotal"
    | "amountPaise"
    | "currency"
    | "usageMonths"
    | "razorpayPaymentId"
  >,
  customer: CompanyBillingProfile
): string {
  const vendor = getInvoiceVendor();
  const paidAt = order.paidAt ?? new Date();
  const invoiceNo = resolveInvoiceNumber(order);
  const total = paiseToRupees(order.amountPaise);
  const subtotal = total + order.discountTotal;
  const dateStr = paidAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const months = order.usageMonths ?? 1;
  const currency = order.currency === "INR" ? "INR" : order.currency;
  const amountLabel = currency === "INR" ? "Rs." : `${currency} `;

  const vendorBlock = renderPartyBlock(
    "Supplier",
    vendor.legalName,
    formatVendorAddressLines(vendor),
    [
      { label: "GSTIN", value: vendor.gstin ?? "" },
      { label: "PAN", value: vendor.pan ?? "" },
      { label: "CIN", value: vendor.cin ?? "" },
      { label: "Email", value: vendor.email },
      { label: "Phone", value: vendor.phone ?? "" },
      { label: "Website", value: vendor.website },
    ]
  );

  const customerBlock = renderPartyBlock(
    "Bill To",
    customer.legalName,
    formatBillingAddressBlock(customer),
    [
      { label: "GSTIN / Tax ID", value: customer.gstin ?? "" },
      { label: "Email", value: customer.email },
      { label: "Phone", value: customer.phone ?? "" },
    ]
  );

  const lineDescription = `HeresNow subscription — ${order.employeeCount} seat(s) × Rs.${order.pricePerUser}/user/month × ${months} month(s)`;
  const lineNote = `Login seats: ${order.employeeCount} · Term: ${months} month(s) · SAC: 998313`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tax Invoice ${invoiceNo} — ${escapeHtml(vendor.productName)}</title>
  <style>
    :root {
      --fg: #1d1d1f;
      --fg-secondary: rgba(60, 60, 67, 0.6);
      --fg-tertiary: rgba(60, 60, 67, 0.4);
      --bg: #f2f2f7;
      --surface: #ffffff;
      --separator: rgba(60, 60, 67, 0.18);
      --fill: rgba(120, 120, 128, 0.08);
      --blue: #007aff;
      --radius: 0.75rem;
      --radius-lg: 1rem;
      --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--fg);
      font-size: 15px;
      line-height: 1.47;
      letter-spacing: -0.016em;
      -webkit-font-smoothing: antialiased;
      padding: 2.5rem 1.25rem 3rem;
    }
    .sheet {
      max-width: 44rem;
      margin: 0 auto;
      background: var(--surface);
      border-radius: var(--radius-lg);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .sheet-inner { padding: 2rem 2rem 1.75rem; }
    .brand-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--separator);
      margin-bottom: 1.75rem;
    }
    .brand-mark {
      font-size: 1.0625rem;
      font-weight: 600;
      letter-spacing: -0.022em;
      color: var(--fg);
    }
    .brand-sub {
      margin-top: 0.2rem;
      font-size: 0.8125rem;
      color: var(--fg-secondary);
    }
    .doc-title {
      margin-top: 0.75rem;
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.028em;
      line-height: 1.1;
    }
    .meta-grid {
      display: grid;
      gap: 0.5rem;
      text-align: right;
      font-size: 0.8125rem;
      min-width: 11rem;
    }
    .meta-row { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .meta-label { color: var(--fg-secondary); min-width: 5.5rem; }
    .meta-value { font-weight: 600; color: var(--fg); }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.875rem;
      margin-bottom: 1.75rem;
    }
    .party-card {
      background: var(--fill);
      border-radius: var(--radius);
      padding: 1rem 1.125rem;
    }
    .party-eyebrow {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--fg-secondary);
      margin-bottom: 0.5rem;
    }
    .party-name {
      font-size: 0.9375rem;
      font-weight: 600;
      letter-spacing: -0.018em;
      margin-bottom: 0.45rem;
    }
    .party-line {
      font-size: 0.8125rem;
      color: var(--fg-secondary);
      line-height: 1.45;
    }
    .party-meta { margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid var(--separator); }
    .party-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.5rem;
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }
    .party-meta-label { color: var(--fg-tertiary); font-weight: 500; }
    .party-meta-value { color: var(--fg-secondary); }
    .section-label {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--fg-secondary);
      margin-bottom: 0.65rem;
    }
    .lines-table { width: 100%; border-collapse: collapse; }
    .lines-table th {
      text-align: left;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--fg-secondary);
      padding: 0 0 0.65rem;
      border-bottom: 1px solid var(--separator);
    }
    .lines-table th.num { text-align: right; }
    .lines-table td {
      padding: 0.875rem 0;
      font-size: 0.8125rem;
      vertical-align: top;
      border-bottom: 1px solid var(--separator);
    }
    .lines-table td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .line-primary { font-weight: 500; color: var(--fg); }
    .line-secondary { margin-top: 0.25rem; font-size: 0.75rem; color: var(--fg-secondary); }
    .summary {
      margin-top: 1.25rem;
      display: flex;
      justify-content: flex-end;
    }
    .summary-card {
      width: 100%;
      max-width: 16.5rem;
      background: var(--fill);
      border-radius: var(--radius);
      padding: 0.875rem 1rem;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.3rem 0;
      font-size: 0.8125rem;
      color: var(--fg-secondary);
    }
    .summary-row span:last-child {
      font-variant-numeric: tabular-nums;
      color: var(--fg);
      font-weight: 500;
    }
    .summary-grand {
      margin-top: 0.5rem;
      padding-top: 0.65rem;
      border-top: 1px solid var(--separator);
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
    }
    .summary-grand-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fg);
    }
    .summary-grand-value {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.024em;
      font-variant-numeric: tabular-nums;
      color: var(--fg);
    }
    .ref-block {
      margin-top: 1.5rem;
      padding: 0.75rem 1rem;
      background: var(--fill);
      border-radius: var(--radius);
      font-size: 0.75rem;
      color: var(--fg-secondary);
    }
    .ref-block strong { color: var(--fg); font-weight: 600; }
    .foot {
      margin-top: 1.75rem;
      padding-top: 1rem;
      border-top: 1px solid var(--separator);
      font-size: 0.6875rem;
      color: var(--fg-tertiary);
      text-align: center;
      line-height: 1.5;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border-radius: 0; max-width: none; }
      .sheet-inner { padding: 0; }
      .party-card, .summary-card, .ref-block { break-inside: avoid; }
    }
    @media (max-width: 640px) {
      .sheet-inner { padding: 1.25rem; }
      .brand-row { flex-direction: column; }
      .meta-grid { text-align: left; }
      .meta-row { justify-content: flex-start; }
      .parties { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-inner">
      <header class="brand-row">
        <div>
          <div class="brand-mark">${escapeHtml(vendor.productName)}</div>
          <div class="brand-sub">${escapeHtml(vendor.legalName)}</div>
          <h1 class="doc-title">Tax Invoice</h1>
        </div>
        <div class="meta-grid">
          <div class="meta-row"><span class="meta-label">Invoice no.</span><span class="meta-value">${invoiceNo}</span></div>
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${dateStr}</span></div>
          <div class="meta-row"><span class="meta-label">Currency</span><span class="meta-value">${escapeHtml(currency)}</span></div>
        </div>
      </header>

      <div class="parties">
        ${vendorBlock}
        ${customerBlock}
      </div>

      <div class="section-label">Line items</div>
      <table class="lines-table">
        <thead>
          <tr>
            <th style="width:2rem">#</th>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Rate</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <div class="line-primary">${escapeHtml(lineDescription)}</div>
              <div class="line-secondary">${escapeHtml(lineNote)}</div>
            </td>
            <td class="num">${order.employeeCount} × ${months} mo</td>
            <td class="num">${amountLabel}${order.pricePerUser.toLocaleString("en-IN")}</td>
            <td class="num">${subtotal.toLocaleString("en-IN")}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-card">
          <div class="summary-row"><span>Subtotal</span><span>${amountLabel}${subtotal.toLocaleString("en-IN")}</span></div>
          ${
            order.discountTotal > 0
              ? `<div class="summary-row"><span>Discount</span><span>−${amountLabel}${order.discountTotal.toLocaleString("en-IN")}</span></div>`
              : ""
          }
          <div class="summary-grand">
            <span class="summary-grand-label">Amount paid</span>
            <span class="summary-grand-value">${amountLabel}${total.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      ${
        order.razorpayPaymentId
          ? `<div class="ref-block"><strong>Payment reference</strong> · Razorpay ${escapeHtml(order.razorpayPaymentId)}</div>`
          : ""
      }

      <p class="foot">Computer-generated tax invoice · ${escapeHtml(vendor.legalName)} · ${escapeHtml(vendor.productName)} subscription services</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function serializePaymentOrder(order: PaymentOrder) {
  const paidAt = order.paidAt?.toISOString() ?? null;
  const gst = resolveOrderGst(order);
  return {
    id: order.id,
    status: order.status,
    paidAt,
    employeeCount: order.employeeCount,
    usageMonths: order.usageMonths,
    pricePerUser: order.pricePerUser,
    discountTotal: order.discountTotal,
    amountPaise: order.amountPaise,
    amount: gst.grandTotal,
    taxableAmount: gst.taxableAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    gstTotal: gst.gstTotal,
    isIntraState: gst.isIntraState,
    currency: order.currency,
    razorpayPaymentId: order.razorpayPaymentId,
    invoiceNumber: order.paidAt ? resolveInvoiceNumber(order) : null,
    invoiceFilename: order.paidAt ? formatInvoiceFilename(order.paidAt) : null,
    eInvoiceStatus: order.eInvoiceStatus,
    eInvoiceIrn: order.eInvoiceIrn,
    eInvoiceLastError: order.eInvoiceLastError,
  };
}
