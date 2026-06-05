import type { Prisma } from "@prisma/client";

/** NIC GST e-Invoice DocDtls.No — max 16 chars; alphanumeric plus `/` and `-` only. */
export const NIC_INVOICE_NUMBER_MAX_LENGTH = 16;

const DEFAULT_PREFIX = "HN";

export type InvoiceNumberOrder = {
  invoiceNumber?: string | null;
  id: string;
  paidAt: Date | null;
};

function getKolkataYmd(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  return { year, month };
}

/** Indian financial year code, e.g. April 2026 → `2627`. */
export function getIndianFinancialYearCode(date: Date): string {
  const { year, month } = getKolkataYmd(date);
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  return `${String(fyStartYear).slice(-2)}${String(fyEndYear).slice(-2)}`;
}

export function getInvoiceNumberPrefix(): string {
  const prefix = process.env.INVOICE_NUMBER_PREFIX?.trim() || DEFAULT_PREFIX;
  return prefix.replace(/[^a-zA-Z0-9/-]/g, "").slice(0, 6) || DEFAULT_PREFIX;
}

/** `{prefix}/{FY}/{serial}` — e.g. `HN/2627/00001` (GST e-Invoice compliant). */
export function formatStandardInvoiceNumber(fyCode: string, serial: number): string {
  const prefix = getInvoiceNumberPrefix();
  const maxSerialDigits = Math.min(
    5,
    NIC_INVOICE_NUMBER_MAX_LENGTH - prefix.length - fyCode.length - 2
  );
  const padded = String(serial).padStart(Math.max(1, maxSerialDigits), "0");
  const number = `${prefix}/${fyCode}/${padded}`;
  assertNicInvoiceNumber(number);
  return number;
}

export function assertNicInvoiceNumber(number: string): void {
  if (number.length < 1 || number.length > NIC_INVOICE_NUMBER_MAX_LENGTH) {
    throw new Error(
      `Invoice number must be 1–${NIC_INVOICE_NUMBER_MAX_LENGTH} characters (got ${number.length}: ${number})`
    );
  }
  if (!/^[A-Za-z0-9/-]+$/.test(number)) {
    throw new Error(`Invoice number contains invalid characters: ${number}`);
  }
}

/** Prefer stored number; legacy fallback for unpaid or pre-migration rows. */
export function resolveInvoiceNumber(order: InvoiceNumberOrder): string {
  if (order.invoiceNumber?.trim()) {
    return order.invoiceNumber.trim();
  }
  if (!order.paidAt) {
    return `${getInvoiceNumberPrefix()}/DRAFT/${order.id.slice(-6).toUpperCase()}`;
  }
  return formatLegacyInvoiceNumber(order.id, order.paidAt);
}

/** @deprecated Pre-standard numbering — only for display until backfilled. */
export function formatLegacyInvoiceNumber(orderId: string, paidAt: Date): string {
  const ymd = formatInvoiceDateYmd(paidAt);
  return `${getInvoiceNumberPrefix()}-${ymd}-${orderId.slice(-8).toUpperCase()}`;
}

export function formatInvoiceDateYmd(paidAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(paidAt);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}

type Tx = Pick<Prisma.TransactionClient, "invoiceNumberSequence" | "paymentOrder">;

export async function allocateInvoiceNumber(tx: Tx, paidAt: Date): Promise<string> {
  const fyCode = getIndianFinancialYearCode(paidAt);

  const existing = await tx.invoiceNumberSequence.findUnique({
    where: { financialYear: fyCode },
  });

  let serial: number;
  if (existing) {
    const updated = await tx.invoiceNumberSequence.update({
      where: { financialYear: fyCode },
      data: { lastSerial: { increment: 1 } },
    });
    serial = updated.lastSerial;
  } else {
    const created = await tx.invoiceNumberSequence.create({
      data: { financialYear: fyCode, lastSerial: 1 },
    });
    serial = created.lastSerial;
  }

  return formatStandardInvoiceNumber(fyCode, serial);
}

export async function ensureInvoiceNumber(
  tx: Tx,
  orderId: string,
  paidAt: Date
): Promise<string> {
  const order = await tx.paymentOrder.findUnique({
    where: { id: orderId },
    select: { invoiceNumber: true },
  });
  if (order?.invoiceNumber?.trim()) {
    return order.invoiceNumber.trim();
  }

  const invoiceNumber = await allocateInvoiceNumber(tx, paidAt);
  await tx.paymentOrder.update({
    where: { id: orderId },
    data: { invoiceNumber },
  });
  return invoiceNumber;
}
