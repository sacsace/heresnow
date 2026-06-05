"use client";

import { useI18n } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
};

/** Apple HIG 스타일 안내 알림 — 확인 버튼만 (성공·완료 메시지) */
export function AppleAlertDialog({
  open,
  title,
  message,
  buttonLabel,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const label = buttonLabel ?? t("common.confirm");

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="apple-alert-title"
      aria-describedby="apple-alert-message"
    >
      <button
        type="button"
        aria-label={label}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/25 backdrop-blur-[6px] transition-opacity"
      />

      <div
        className="relative w-full max-w-[17.5rem] overflow-hidden rounded-[0.875rem] bg-[var(--background)] shadow-[0_8px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:max-w-[20rem] sm:rounded-[0.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pb-4 pt-5 text-center sm:px-5 sm:pt-5 sm:text-left">
          <h2
            id="apple-alert-title"
            className="text-[1.0625rem] font-semibold leading-snug tracking-tight text-[var(--foreground)]"
          >
            {title}
          </h2>
          <p
            id="apple-alert-message"
            className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]"
          >
            {message}
          </p>
        </div>

        <div className="border-t border-[var(--separator)] sm:flex sm:justify-end sm:px-4 sm:py-3">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="touch-manipulation min-h-[2.75rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] sm:min-h-0 sm:w-auto sm:rounded-[0.4375rem] sm:bg-[var(--apple-blue)] sm:px-3.5 sm:py-1.5 sm:text-[0.8125rem] sm:text-white sm:hover:bg-[#0071e3] sm:active:bg-[#0066cc]"
          >
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
