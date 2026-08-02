"use client";

import { useI18n } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";
import { authLangSegmentedBtn, authLangSegmentedWrap } from "@/lib/uiStyles";
import { useEffect, useRef, useState } from "react";

const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

type Props = {
  /** auth: 로그인·가입·동의 — 더 큰 언어 박스; door: 출입문 단말(항상 라벨 표시) */
  variant?: "default" | "auth" | "door";
};

export function LanguageSwitcher({ variant = "default" }: Props) {
  const { locale, setLocale, t } = useI18n();
  const isAuth = variant === "auth";
  const isDoor = variant === "door";
  const isDefault = !isAuth && !isDoor;
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDefault || !open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDefault, open]);

  if (isDefault) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("common.language")}
          className="inline-flex h-8 items-center gap-1.5 rounded-[0.625rem] border border-[var(--separator)] bg-[var(--fill-secondary)] px-2.5 text-[0.75rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary-hover)]"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span>{locale === "ko" ? "한국어" : "English"}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div
            role="menu"
            aria-label={t("common.language")}
            className="absolute right-0 z-50 mt-1.5 w-[7rem] overflow-hidden rounded-[0.625rem] border border-[var(--separator)] bg-white shadow-[0_8px_20px_rgba(24,39,75,0.16)]"
          >
            {(["ko", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={locale === l}
                className={`flex h-8 w-full items-center px-2.5 text-left text-[0.75rem] font-medium transition-colors ${
                  locale === l
                    ? "bg-[var(--fill-tertiary)] text-[var(--foreground)]"
                    : "text-[var(--apple-label-secondary)] hover:bg-[var(--fill-secondary)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
              >
                {LOCALE_NATIVE_LABEL[l]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const wrap = authLangSegmentedWrap;
  const btn = authLangSegmentedBtn;

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
          <span className="inline">{LOCALE_NATIVE_LABEL[l]}</span>
        </button>
      ))}
    </div>
  );
}
