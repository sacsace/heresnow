import type { Company, PaymentOrder } from "@prisma/client";

export const DEFAULT_COMPANY_BILLING_EMAIL = "info@msventures.in";

export type CompanyBillingProfile = {
  legalName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gstin: string | null;
  email: string;
  phone: string | null;
};

export type CompanyBillingFields = Pick<
  Company,
  | "name"
  | "billingLegalName"
  | "billingAddressLine1"
  | "billingAddressLine2"
  | "billingCity"
  | "billingState"
  | "billingPostalCode"
  | "billingCountry"
  | "billingGstin"
  | "billingEmail"
  | "billingPhone"
>;

export const companyBillingSelect = {
  name: true,
  billingLegalName: true,
  billingAddressLine1: true,
  billingAddressLine2: true,
  billingCity: true,
  billingState: true,
  billingPostalCode: true,
  billingCountry: true,
  billingGstin: true,
  billingEmail: true,
  billingPhone: true,
} as const;

function trimOrNull(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

function mergeLegacyAddress(line1: string | null | undefined, line2: string | null | undefined): string {
  return [trimOrNull(line1), trimOrNull(line2)].filter(Boolean).join(", ");
}

export function getCompanyBillingProfile(
  company: CompanyBillingFields
): CompanyBillingProfile {
  return {
    legalName: trimOrNull(company.billingLegalName) ?? company.name.trim(),
    address: mergeLegacyAddress(company.billingAddressLine1, company.billingAddressLine2),
    city: trimOrNull(company.billingCity) ?? "",
    state: trimOrNull(company.billingState) ?? "",
    postalCode: trimOrNull(company.billingPostalCode) ?? "",
    country: trimOrNull(company.billingCountry) ?? "India",
    gstin: trimOrNull(company.billingGstin),
    email: trimOrNull(company.billingEmail) ?? DEFAULT_COMPANY_BILLING_EMAIL,
    phone: trimOrNull(company.billingPhone),
  };
}

export function isBillingProfileComplete(profile: CompanyBillingProfile): boolean {
  return (
    profile.legalName.length > 0 &&
    profile.address.length > 0 &&
    profile.city.length > 0 &&
    profile.state.length > 0 &&
    profile.postalCode.length > 0 &&
    profile.country.length > 0 &&
    profile.email.length > 0 &&
    profile.email.includes("@")
  );
}

export function snapshotBillingProfile(
  profile: CompanyBillingProfile
): CompanyBillingProfile {
  return { ...profile };
}

export function parseInvoiceCustomerSnapshot(
  raw: PaymentOrder["invoiceCustomerSnapshot"]
): CompanyBillingProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const legalName = typeof o.legalName === "string" ? o.legalName.trim() : "";
  if (!legalName) return null;
  return {
    legalName,
    address:
      typeof o.address === "string" && o.address.trim()
        ? o.address.trim()
        : mergeLegacyAddress(
            typeof o.addressLine1 === "string" ? o.addressLine1 : "",
            typeof o.addressLine2 === "string" ? o.addressLine2 : null
          ),
    city: typeof o.city === "string" ? o.city.trim() : "",
    state: typeof o.state === "string" ? o.state.trim() : "",
    postalCode: typeof o.postalCode === "string" ? o.postalCode.trim() : "",
    country:
      typeof o.country === "string" && o.country.trim() ? o.country.trim() : "India",
    gstin:
      typeof o.gstin === "string" && o.gstin.trim() ? o.gstin.trim() : null,
    email: typeof o.email === "string" ? o.email.trim() : "",
    phone:
      typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null,
  };
}

export function resolveInvoiceCustomer(
  order: Pick<PaymentOrder, "invoiceCustomerSnapshot">,
  company: CompanyBillingFields
): CompanyBillingProfile {
  return (
    parseInvoiceCustomerSnapshot(order.invoiceCustomerSnapshot) ??
    getCompanyBillingProfile(company)
  );
}

/** Bill To / PDF — street, city, state, PIN, country on one line. */
export function formatBillingAddressBlock(profile: CompanyBillingProfile): string[] {
  const line = [
    profile.address,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.country,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  return line ? [line] : [];
}

export function serializeBillingProfileForApi(profile: CompanyBillingProfile) {
  return {
    legalName: profile.legalName,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    postalCode: profile.postalCode,
    country: profile.country,
    gstin: profile.gstin,
    email: profile.email,
    phone: profile.phone,
    complete: isBillingProfileComplete(profile),
  };
}
