import type { Locale } from "@/lib/i18n/dictionaries";

export const DEFAULT_LOCALE: Locale = "ko";

export function normalizeLocale(input: string | null | undefined): Locale | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "en" || raw.startsWith("en-")) return "en";
  if (raw === "ko" || raw.startsWith("ko-")) return "ko";
  return null;
}

export function localeFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
  fallback: Locale = DEFAULT_LOCALE
): Locale {
  const raw = (acceptLanguage ?? "").trim();
  if (!raw) return fallback;
  const parts = raw.split(",");
  for (const p of parts) {
    const token = p.split(";")[0]?.trim();
    const normalized = normalizeLocale(token);
    if (normalized) return normalized;
  }
  return fallback;
}

export function resolvePreferredLocale(options: {
  cookieLocale?: string | null | undefined;
  acceptLanguage?: string | null | undefined;
  fallback?: Locale;
}): Locale {
  const fallback = options.fallback ?? DEFAULT_LOCALE;
  const cookieLocale = normalizeLocale(options.cookieLocale);
  if (cookieLocale) return cookieLocale;
  return localeFromAcceptLanguage(options.acceptLanguage, fallback);
}
