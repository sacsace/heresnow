"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  AppleDialogBackdrop,
  AppleDialogHeader,
  AppleDialogPanel,
  type AppleDialogVariant,
} from "@/components/ui/appleDialogShared";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  /** default = 파란 강조, warning = 주황 아이콘, success = 초록 체크 */
  variant?: AppleDialogVariant;
  onClose: () => void;
};

/** Apple HIG 스타일 안내 알림 — 확인 버튼만 */
export function AppleAlertDialog({
  open,
  title,
  message,
  buttonLabel,
  variant = "default",
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
      className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="apple-alert-title"
      aria-describedby="apple-alert-message"
    >
      <AppleDialogBackdrop onClose={onClose} ariaLabel={label} />

      <AppleDialogPanel className="sm:animate-none">
        <AppleDialogHeader
          title={title}
          message={message}
          variant={variant}
          titleId="apple-alert-title"
          messageId="apple-alert-message"
        />

        <div className="border-t border-[var(--separator)]">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="touch-manipulation min-h-[3rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] sm:min-h-[2.75rem]"
          >
            {label}
          </button>
        </div>
      </AppleDialogPanel>
    </div>,
    document.body
  );
}
