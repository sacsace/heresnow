import { STORAGE_KEY, type Locale } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, resolvePreferredLocale } from "@/lib/i18n/locale";
import { cookies, headers } from "next/headers";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolvePreferredLocale({
    cookieLocale: cookieStore.get(STORAGE_KEY)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    fallback: DEFAULT_LOCALE,
  });
}
