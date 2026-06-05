export function isEInvoiceEnabled(): boolean {
  return process.env.EINVOICE_ENABLED?.trim().toLowerCase() === "true";
}

export function isEInvoiceMockMode(): boolean {
  return process.env.EINVOICE_MOCK?.trim() === "1";
}

export function getEInvoiceGspConfig(): { apiUrl: string; authToken: string } | null {
  const apiUrl = process.env.EINVOICE_GSP_API_URL?.trim();
  const authToken = process.env.EINVOICE_GSP_AUTH_TOKEN?.trim();
  if (!apiUrl || !authToken) return null;
  return { apiUrl, authToken };
}

export function isEInvoiceConfigured(): boolean {
  return isEInvoiceEnabled() && (isEInvoiceMockMode() || getEInvoiceGspConfig() !== null);
}
