"use client";

import {
  STORAGE_KEY,
  type Locale,
  pickMessages,
  translate,
  type Messages,
} from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/locale";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string) => string;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}

function readStoredLocale(initialLocale: Locale): Locale {
  if (typeof window === "undefined") return initialLocale;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeLocale(s);
    if (normalized) return normalized;
  } catch {
    /* ignore */
  }
  return detectBrowserLocale();
}

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale(initialLocale));
    setMounted(true);
  }, [initialLocale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l === "ko" ? "ko" : "en";
      document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale === "ko" ? "ko" : "en";
  }, [locale, mounted]);

  const messages = useMemo(() => pickMessages(locale), [locale]);
  const t = useCallback((path: string) => translate(messages, path), [messages]);

  const value = useMemo(
    () => ({ locale, setLocale, t, messages }),
    [locale, setLocale, t, messages]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}
