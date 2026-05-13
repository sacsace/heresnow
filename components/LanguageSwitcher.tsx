"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

/** 각 언어의 고유 표기(선택 UI와 무관하게 동일) */
const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

/** 심플 라이트 토글 — 모든 화면 공통 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1 py-0.5 text-xs text-zinc-600">
      <span className="sr-only">{t("common.language")}</span>
      {(["ko", "en"] as const).map((l: Locale) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={
            locale === l
              ? "rounded px-2 py-0.5 font-medium text-zinc-900 ring-1 ring-sky-300/80 bg-sky-50"
              : "rounded px-2 py-0.5 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
          }
        >
          {LOCALE_NATIVE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
