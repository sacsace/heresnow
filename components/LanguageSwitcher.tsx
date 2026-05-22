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
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-[0.5rem] bg-[#787880]/[0.12] p-0.5 text-[0.8125rem] text-[#3c3c43]">
      <span className="sr-only">{t("common.language")}</span>
      {(["ko", "en"] as const).map((l: Locale) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={
            locale === l
              ? "rounded-[0.375rem] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f] shadow-sm"
              : "rounded-[0.375rem] px-2.5 py-1 text-[#3c3c43]/70 hover:text-[#1d1d1f]"
          }
        >
          {LOCALE_NATIVE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
