"use client";

import {
  STORAGE_KEY,
  type Locale,
  pickMessages,
  translate,
  type Messages,
} from "@/lib/i18n/dictionaries";
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

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "ko";
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "en" || s === "ko") return s;
  } catch {
    /* ignore */
  }
  return "ko";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setMounted(true);
  }, []);

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
