"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";
import {
  authLangSegmentedBtn,
  authLangSegmentedWrap,
  langSegmentedBtn,
  langSegmentedWrap,
} from "@/lib/uiStyles";

const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

const LOCALE_SHORT: Record<Locale, string> = {
  ko: "KO",
  en: "EN",
};

type Props = {
  /** auth: 로그인·가입·동의 — 더 큰 언어 박스 */
  variant?: "default" | "auth";
};

export function LanguageSwitcher({ variant = "default" }: Props) {
  const { locale, setLocale, t } = useI18n();
  const isAuth = variant === "auth";
  const wrap = isAuth ? authLangSegmentedWrap : langSegmentedWrap;
  const btn = isAuth ? authLangSegmentedBtn : langSegmentedBtn;

  return (
    <div className={wrap} role="group" aria-label={t("common.language")}>
      {(["ko", "en"] as const).map((l: Locale) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          aria-label={LOCALE_NATIVE_LABEL[l]}
          onClick={() => setLocale(l)}
          className={btn(locale === l)}
        >
          <span className={isAuth ? "inline" : "hidden sm:inline"}>{LOCALE_NATIVE_LABEL[l]}</span>
          {!isAuth && <span className="sm:hidden">{LOCALE_SHORT[l]}</span>}
        </button>
      ))}
    </div>
  );
}
