import type { NicEInvoicePayload } from "@/lib/eInvoice/buildPayload";
import {
  getEInvoiceGspConfig,
  isEInvoiceMockMode,
} from "@/lib/eInvoice/config";
import { createHash, randomBytes } from "node:crypto";

export type EInvoiceSubmitResult = {
  irn: string;
  ackNo: string;
  ackAt: Date;
  signedQrCode: string;
};

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseAckDate(raw: string | null): Date {
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : new Date();
}

function parseGspResponse(json: unknown): EInvoiceSubmitResult {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid e-Invoice GSP response");
  }
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root.result && typeof root.result === "object"
        ? (root.result as Record<string, unknown>)
        : root;

  const irn = pickString(data, "Irn", "irn", "IRN");
  const ackNo = pickString(data, "AckNo", "ackNo", "AckNum");
  const signedQrCode = pickString(
    data,
    "SignedQRCode",
    "SignedQrCode",
    "signedQRCode",
    "signedQrCode"
  );
  const ackDt = pickString(data, "AckDt", "ackDt", "AckDate", "ackDate");

  if (!irn || !signedQrCode) {
    const err =
      pickString(root, "error", "message", "ErrorMessage") ??
      pickString(data, "error", "message", "ErrorMessage") ??
      "e-Invoice IRN not returned by GSP";
    throw new Error(err);
  }

  return {
    irn,
    ackNo: ackNo ?? "",
    ackAt: parseAckDate(ackDt),
    signedQrCode,
  };
}

async function submitMock(payload: NicEInvoicePayload): Promise<EInvoiceSubmitResult> {
  const seed = `${payload.DocDtls.No}-${payload.DocDtls.Dt}`;
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 32).toUpperCase();
  return {
    irn: hash,
    ackNo: String(Math.floor(100000000000 + Math.random() * 899999999999)),
    ackAt: new Date(),
    signedQrCode: `MOCK|${payload.SellerDtls.Gstin}|${payload.BuyerDtls.Gstin}|${payload.DocDtls.No}|${payload.ValDtls.TotInvVal}|${randomBytes(8).toString("hex")}`,
  };
}

export async function submitNicEInvoice(payload: NicEInvoicePayload): Promise<EInvoiceSubmitResult> {
  if (isEInvoiceMockMode()) {
    return submitMock(payload);
  }

  const config = getEInvoiceGspConfig();
  if (!config) {
    throw new Error("E-Invoice GSP is not configured (EINVOICE_GSP_API_URL / TOKEN)");
  }

  const res = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.authToken}`,
    },
    body: JSON.stringify({ payload }),
    signal: AbortSignal.timeout(30_000),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`e-Invoice GSP HTTP ${res.status}: invalid JSON response`);
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : `e-Invoice GSP HTTP ${res.status}`;
    throw new Error(msg);
  }

  return parseGspResponse(json);
}
