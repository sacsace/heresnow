export type InvoiceVendor = {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  email: string;
  phone: string | null;
  website: string;
  productName: string;
};

function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function envOptional(key: string): string | null {
  const s = process.env[key]?.trim();
  return s ? s : null;
}

/** Minsub Ventures Private Limited — supplier on tax invoices (English). */
const DEFAULT_VENDOR_ADDRESS =
  "24/1, Doddanekundi, Ferns City Road, Outer Ring Road, Marathahalli, Bengaluru, Karnataka 560037";

export function getInvoiceVendor(): InvoiceVendor {
  return {
    legalName: env("INVOICE_VENDOR_LEGAL_NAME", "Minsub Ventures Private Limited"),
    addressLine1: env("INVOICE_VENDOR_ADDRESS_LINE1", DEFAULT_VENDOR_ADDRESS),
    addressLine2: envOptional("INVOICE_VENDOR_ADDRESS_LINE2"),
    city: env("INVOICE_VENDOR_CITY", "Bengaluru"),
    state: env("INVOICE_VENDOR_STATE", "Karnataka"),
    postalCode: env("INVOICE_VENDOR_POSTAL_CODE", "560037"),
    country: env("INVOICE_VENDOR_COUNTRY", "India"),
    gstin: envOptional("INVOICE_VENDOR_GSTIN"),
    pan: envOptional("INVOICE_VENDOR_PAN"),
    cin: envOptional("INVOICE_VENDOR_CIN"),
    email: env("INVOICE_VENDOR_EMAIL", "billing@minsubventures.com"),
    phone: envOptional("INVOICE_VENDOR_PHONE"),
    website: env("INVOICE_VENDOR_WEBSITE", "https://www.heresnow.in"),
    productName: env("INVOICE_VENDOR_PRODUCT", "HeresNow"),
  };
}

export function formatVendorAddressLines(vendor: InvoiceVendor): string[] {
  const lines: string[] = [];
  if (vendor.addressLine1) lines.push(vendor.addressLine1);
  if (vendor.addressLine2) lines.push(vendor.addressLine2);
  const cityLine = [vendor.city, vendor.state, vendor.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    const line1 = vendor.addressLine1.toLowerCase();
    const cityInLine1 = vendor.city && line1.includes(vendor.city.toLowerCase());
    const pinInLine1 = vendor.postalCode && line1.includes(vendor.postalCode);
    if (!(cityInLine1 && pinInLine1)) {
      lines.push(cityLine);
    }
  }
  if (vendor.country) lines.push(vendor.country);
  return lines;
}
