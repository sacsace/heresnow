import type { PaymentOrder } from "@prisma/client";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { resolveInvoiceNumber } from "@/lib/invoiceNumber";
import {
  formatBillingAddressBlock,
  type CompanyBillingProfile,
} from "@/lib/companyBillingProfile";
import { resolveOrderGst } from "@/lib/gst";
import { formatVendorAddressLines, getInvoiceVendor } from "@/lib/invoiceVendor";

const C = {
  fg: "#1d1d1f",
  secondary: "#6e6e73",
  tertiary: "#86868b",
  fill: "#f2f2f7",
  separator: "#d2d2d7",
  white: "#ffffff",
};

type InvoiceOrder = Pick<
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
  | "taxableAmountPaise"
  | "cgstPaise"
  | "sgstPaise"
  | "igstPaise"
  | "gstRatePercent"
  | "supplierState"
  | "customerState"
  | "eInvoiceStatus"
  | "eInvoiceIrn"
  | "eInvoiceAckNo"
  | "eInvoiceAckAt"
  | "eInvoiceSignedQrCode"
>;

function formatInr(amount: number): string {
  return amount.toLocaleString("en-IN");
}

type PartyCardContent = {
  title: string;
  name: string;
  addressLines: string[];
  extras: { label: string; value: string }[];
};

function measurePartyCardHeight(
  doc: InstanceType<typeof PDFDocument>,
  width: number,
  content: PartyCardContent
): number {
  const padding = 12;
  const innerWidth = width - padding * 2;
  const filteredExtras = content.extras.filter((e) => e.value);
  const addr = content.addressLines.filter(Boolean);

  let contentHeight = padding + 4 + 14;
  doc.font("Helvetica-Bold").fontSize(10);
  contentHeight += doc.heightOfString(content.name, { width: innerWidth }) + 4;
  doc.font("Helvetica").fontSize(8.5);
  for (const line of addr.length ? addr : ["—"]) {
    contentHeight += doc.heightOfString(line, { width: innerWidth, lineGap: 1 }) + 2;
  }
  if (filteredExtras.length > 0) {
    contentHeight += 4 + 8;
    doc.fontSize(7.5);
    for (const extra of filteredExtras) {
      contentHeight +=
        doc.heightOfString(`${extra.label}: ${extra.value}`, { width: innerWidth }) + 2;
    }
  }
  contentHeight += padding;
  return Math.max(contentHeight, 88);
}

function drawPartyCardLayered(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  cardHeight: number,
  content: PartyCardContent
): void {
  const padding = 12;
  const innerWidth = width - padding * 2;
  const filteredExtras = content.extras.filter((e) => e.value);
  const addr = content.addressLines.filter(Boolean);

  doc.roundedRect(x, y, width, cardHeight, 8).fill(C.fill);

  let textY = y + padding + 4;
  doc.font("Helvetica-Bold").fontSize(7).fillColor(C.secondary);
  doc.text(content.title.toUpperCase(), x + padding, textY, {
    width: innerWidth,
    characterSpacing: 0.6,
  });
  textY += 14;

  doc.font("Helvetica-Bold").fontSize(10).fillColor(C.fg);
  doc.text(content.name, x + padding, textY, { width: innerWidth });
  textY += doc.heightOfString(content.name, { width: innerWidth }) + 4;

  doc.font("Helvetica").fontSize(8.5).fillColor(C.secondary);
  for (const line of addr.length ? addr : ["—"]) {
    doc.text(line, x + padding, textY, { width: innerWidth, lineGap: 1 });
    textY += doc.heightOfString(line, { width: innerWidth, lineGap: 1 }) + 2;
  }

  if (filteredExtras.length > 0) {
    textY += 4;
    doc
      .moveTo(x + padding, textY)
      .lineTo(x + width - padding, textY)
      .strokeColor(C.separator)
      .lineWidth(0.5)
      .stroke();
    textY += 8;
    doc.font("Helvetica").fontSize(7.5).fillColor(C.secondary);
    for (const extra of filteredExtras) {
      doc.text(`${extra.label}: ${extra.value}`, x + padding, textY, { width: innerWidth });
      textY += doc.heightOfString(`${extra.label}: ${extra.value}`, { width: innerWidth }) + 2;
    }
  }
}

export async function buildInvoicePdf(
  order: InvoiceOrder,
  customer: CompanyBillingProfile
): Promise<Buffer> {
  const vendor = getInvoiceVendor();
  const paidAt = order.paidAt ?? new Date();
  const invoiceNo = resolveInvoiceNumber(order);
  const gst = resolveOrderGst(order);
  const total = gst.grandTotal;
  const grossSubtotal = gst.grossSubtotal;
  const taxable = gst.taxableAmount;
  const months = order.usageMonths ?? 1;
  const currency = order.currency === "INR" ? "INR" : order.currency;
  const amountLabel = currency === "INR" ? "Rs." : `${currency} `;
  const dateStr = paidAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lineDescription = `HeresNow subscription — ${order.employeeCount} seat(s) × Rs.${order.pricePerUser}/user/month × ${months} month(s)`;
  const lineNote = `Login seats: ${order.employeeCount} · Term: ${months} month(s) · SAC: 998313`;

  let qrBuffer: Buffer | null = null;
  if (order.eInvoiceStatus === "ISSUED" && order.eInvoiceSignedQrCode) {
    try {
      qrBuffer = await QRCode.toBuffer(order.eInvoiceSignedQrCode, {
        width: 140,
        margin: 1,
        errorCorrectionLevel: "M",
      });
    } catch {
      qrBuffer = null;
    }
  }

  return new Promise((resolve, reject) => {
    const margin = 48;
    const doc = new PDFDocument({ size: "A4", margin, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // White sheet on gray — full page white with subtle framing via margin bg simulated
    doc.rect(0, 0, pageWidth, doc.page.height).fill(C.white);

    // Brand + meta header
    doc.font("Helvetica-Bold").fontSize(11).fillColor(C.fg);
    doc.text(vendor.productName, margin, y);
    doc.font("Helvetica").fontSize(8.5).fillColor(C.secondary);
    doc.text(vendor.legalName, margin, y + 14);

    const metaX = margin + contentWidth * 0.52;
    const metaWidth = contentWidth * 0.48;
    const metaRows: [string, string][] = [
      ["Invoice no.", invoiceNo],
      ["Date", dateStr],
      ["Currency", currency],
    ];
    let metaY = y;
    for (const [label, value] of metaRows) {
      doc.font("Helvetica").fontSize(8).fillColor(C.secondary);
      doc.text(label, metaX, metaY, { width: metaWidth * 0.42, align: "right" });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(C.fg);
      doc.text(value, metaX + metaWidth * 0.44, metaY, { width: metaWidth * 0.56, align: "right" });
      metaY += 14;
    }

    y += 36;
    doc.font("Helvetica-Bold").fontSize(22).fillColor(C.fg);
    doc.text("Tax Invoice", margin, y, { characterSpacing: -0.3 });
    y += 34;

    doc
      .moveTo(margin, y)
      .lineTo(margin + contentWidth, y)
      .strokeColor(C.separator)
      .lineWidth(0.75)
      .stroke();
    y += 18;

    const gap = 10;
    const cardWidth = (contentWidth - gap) / 2;
    const vendorContent: PartyCardContent = {
      title: "Supplier",
      name: vendor.legalName,
      addressLines: formatVendorAddressLines(vendor),
      extras: [
        { label: "GSTIN", value: vendor.gstin ?? "" },
        { label: "PAN", value: vendor.pan ?? "" },
        { label: "CIN", value: vendor.cin ?? "" },
        { label: "Email", value: vendor.email },
        { label: "Phone", value: vendor.phone ?? "" },
        { label: "Website", value: vendor.website },
      ],
    };
    const customerContent: PartyCardContent = {
      title: "Bill To",
      name: customer.legalName,
      addressLines: formatBillingAddressBlock(customer),
      extras: [
        { label: "GSTIN / Tax ID", value: customer.gstin ?? "" },
        { label: "Email", value: customer.email },
        { label: "Phone", value: customer.phone ?? "" },
      ],
    };
    const cardHeight = Math.max(
      measurePartyCardHeight(doc, cardWidth, vendorContent),
      measurePartyCardHeight(doc, cardWidth, customerContent)
    );
    drawPartyCardLayered(doc, margin, y, cardWidth, cardHeight, vendorContent);
    drawPartyCardLayered(doc, margin + cardWidth + gap, y, cardWidth, cardHeight, customerContent);
    y += cardHeight + 22;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(C.secondary);
    doc.text("LINE ITEMS", margin, y, { characterSpacing: 0.5 });
    y += 14;

    const colHash = margin;
    const colDesc = margin + 22;
    const colQty = margin + contentWidth - 190;
    const colRate = margin + contentWidth - 120;
    const colAmt = margin + contentWidth - 52;
    const descWidth = colQty - colDesc - 8;

    doc
      .moveTo(margin, y + 10)
      .lineTo(margin + contentWidth, y + 10)
      .strokeColor(C.separator)
      .lineWidth(0.5)
      .stroke();

    doc.font("Helvetica-Bold").fontSize(7).fillColor(C.secondary);
    doc.text("#", colHash, y);
    doc.text("DESCRIPTION", colDesc, y);
    doc.text("QTY", colQty, y, { width: 50, align: "right" });
    doc.text("RATE", colRate, y, { width: 58, align: "right" });
    doc.text("AMOUNT", colAmt, y, { width: 52, align: "right" });
    y += 16;

    doc
      .moveTo(margin, y)
      .lineTo(margin + contentWidth, y)
      .strokeColor(C.separator)
      .lineWidth(0.5)
      .stroke();
    y += 10;

    doc.font("Helvetica").fontSize(8.5).fillColor(C.fg);
    doc.text("1", colHash, y);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.fg);
    doc.text(lineDescription, colDesc, y, { width: descWidth, lineGap: 1 });
    const descBlockHeight = doc.heightOfString(lineDescription, { width: descWidth, lineGap: 1 });
    doc.font("Helvetica").fontSize(7.5).fillColor(C.secondary);
    doc.text(lineNote, colDesc, y + descBlockHeight + 2, { width: descWidth });
    const rowHeight =
      Math.max(
        descBlockHeight + doc.heightOfString(lineNote, { width: descWidth }) + 6,
        28
      );

    doc.font("Helvetica").fontSize(8.5).fillColor(C.fg);
    doc.text(`${order.employeeCount} × ${months} mo`, colQty, y, { width: 50, align: "right" });
    doc.text(`${amountLabel}${formatInr(order.pricePerUser)}`, colRate, y, {
      width: 58,
      align: "right",
    });
    doc.text(formatInr(grossSubtotal), colAmt, y, { width: 52, align: "right" });

    y += rowHeight + 8;
    doc
      .moveTo(margin, y)
      .lineTo(margin + contentWidth, y)
      .strokeColor(C.separator)
      .lineWidth(0.5)
      .stroke();
    y += 16;

    const summaryWidth = 196;
    const summaryX = margin + contentWidth - summaryWidth;
    let summaryHeight = 24;
    if (order.discountTotal > 0) summaryHeight += 16;
    summaryHeight += 16; // taxable value
    if (gst.gstTotal > 0) {
      summaryHeight += gst.isIntraState ? 32 : 16;
    }
    summaryHeight += 36;

    doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 8).fill(C.fill);

    let sumY = y + 12;
    const drawSummaryRow = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(8.5).fillColor(C.secondary);
      doc.text(label, summaryX + 12, sumY, { width: 88 });
      doc.font("Helvetica").fontSize(8.5).fillColor(C.fg);
      doc.text(value, summaryX + 100, sumY, { width: 84, align: "right" });
      sumY += 16;
    };

    drawSummaryRow("Subtotal", `${amountLabel}${formatInr(grossSubtotal)}`);
    if (order.discountTotal > 0) {
      drawSummaryRow("Discount", `−${amountLabel}${formatInr(order.discountTotal)}`);
    }
    drawSummaryRow("Taxable value", `${amountLabel}${formatInr(taxable)}`);

    if (gst.gstTotal > 0) {
      if (gst.isIntraState) {
        drawSummaryRow(
          `CGST @ ${gst.halfRatePercent}%`,
          `${amountLabel}${formatInr(gst.cgstAmount)}`
        );
        drawSummaryRow(
          `SGST @ ${gst.halfRatePercent}%`,
          `${amountLabel}${formatInr(gst.sgstAmount)}`
        );
      } else {
        drawSummaryRow(
          `IGST @ ${gst.gstRatePercent}%`,
          `${amountLabel}${formatInr(gst.igstAmount)}`
        );
      }
    }

    sumY += 2;
    doc
      .moveTo(summaryX + 12, sumY)
      .lineTo(summaryX + summaryWidth - 12, sumY)
      .strokeColor(C.separator)
      .lineWidth(0.5)
      .stroke();
    sumY += 10;

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.fg);
    doc.text("Amount paid", summaryX + 12, sumY);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(C.fg);
    doc.text(`${amountLabel}${formatInr(total)}`, summaryX + 12, sumY + 2, {
      width: summaryWidth - 24,
      align: "right",
    });

    y += summaryHeight + 18;

    if (order.razorpayPaymentId) {
      const refHeight = 28;
      doc.roundedRect(margin, y, contentWidth, refHeight, 8).fill(C.fill);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.fg);
      doc.text("Payment reference", margin + 12, y + 8);
      doc.font("Helvetica").fontSize(7.5).fillColor(C.secondary);
      doc.text(`Razorpay ${order.razorpayPaymentId}`, margin + 12, y + 18, {
        width: contentWidth - 24,
      });
      y += refHeight + 16;
    }

    if (order.eInvoiceStatus === "ISSUED" && order.eInvoiceIrn) {
      const einvHeight = qrBuffer ? 88 : 52;
      doc.roundedRect(margin, y, contentWidth, einvHeight, 8).fill(C.fill);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.fg);
      doc.text("E-Invoice (IRN)", margin + 12, y + 8);
      doc.font("Helvetica").fontSize(7.5).fillColor(C.secondary);
      doc.text(`IRN: ${order.eInvoiceIrn}`, margin + 12, y + 20, {
        width: qrBuffer ? contentWidth - 120 : contentWidth - 24,
      });
      if (order.eInvoiceAckNo) {
        doc.text(`Ack No: ${order.eInvoiceAckNo}`, margin + 12, y + 32, {
          width: qrBuffer ? contentWidth - 120 : contentWidth - 24,
        });
      }
      if (qrBuffer) {
        doc.image(qrBuffer, margin + contentWidth - 92, y + 10, { width: 72, height: 72 });
      }
      y += einvHeight + 16;
    }

    doc
      .moveTo(margin, y)
      .lineTo(margin + contentWidth, y)
      .strokeColor(C.separator)
      .lineWidth(0.5)
      .stroke();
    y += 10;
    doc.font("Helvetica").fontSize(7).fillColor(C.tertiary);
    doc.text(
      `Computer-generated tax invoice · ${vendor.legalName} · ${vendor.productName} subscription services`,
      margin,
      y,
      { width: contentWidth, align: "center" }
    );

    doc.end();
  });
}
