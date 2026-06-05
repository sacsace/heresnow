/** GST state code (first 2 digits of GSTIN) from GSTIN or normalized state name. */
const STATE_NAME_TO_CODE: Record<string, string> = {
  karnataka: "29",
  "andhra pradesh": "37",
  "arunachal pradesh": "12",
  assam: "18",
  bihar: "10",
  chhattisgarh: "22",
  goa: "30",
  gujarat: "24",
  haryana: "06",
  "himachal pradesh": "02",
  jharkhand: "20",
  kerala: "32",
  "madhya pradesh": "23",
  maharashtra: "27",
  manipur: "14",
  meghalaya: "17",
  mizoram: "15",
  nagaland: "13",
  odisha: "21",
  orissa: "21",
  punjab: "03",
  rajasthan: "08",
  sikkim: "11",
  "tamil nadu": "33",
  telangana: "36",
  tripura: "16",
  "uttar pradesh": "09",
  uttarakhand: "05",
  "west bengal": "19",
  delhi: "07",
  "jammu and kashmir": "01",
  ladakh: "38",
  puducherry: "34",
  chandigarh: "04",
};

export function gstStateCodeFromGstin(gstin: string | null | undefined): string {
  const g = gstin?.trim().toUpperCase() ?? "";
  if (g.length >= 2 && /^\d{2}/.test(g)) return g.slice(0, 2);
  return "";
}

export function gstStateCodeFromName(state: string | null | undefined): string {
  const key = state?.trim().toLowerCase() ?? "";
  if (!key) return "";
  if (STATE_NAME_TO_CODE[key]) return STATE_NAME_TO_CODE[key];
  if (key === "ka") return "29";
  return "";
}

export function resolveGstStateCode(gstin: string | null | undefined, state: string | null | undefined): string {
  return gstStateCodeFromGstin(gstin) || gstStateCodeFromName(state);
}

export function parsePinCode(postalCode: string | null | undefined): number {
  const digits = (postalCode ?? "").replace(/\D/g, "");
  const n = parseInt(digits.slice(0, 6), 10);
  return Number.isFinite(n) ? n : 0;
}
