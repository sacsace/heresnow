"use client";

import { useI18n } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive = 빨간 삭제 버튼 (macOS/iOS Destructive) */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Apple HIG 스타일 확인 알림 — iOS(세로 버튼) / macOS(가로 버튼) 반응형.
 * portal + backdrop blur, 네이티브 confirm() 대체.
 */
export function AppleConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onCancel]);

  if (!mounted || !open) return null;

  const cancel = cancelLabel ?? t("common.cancel");
  const confirm = confirmLabel ?? t("common.confirm");

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="apple-confirm-title"
      aria-describedby="apple-confirm-message"
    >
      <button
        type="button"
        aria-label={cancel}
        disabled={loading}
        onClick={onCancel}
        className="absolute inset-0 h-full w-full bg-black/25 backdrop-blur-[6px] transition-opacity"
      />

      <div
        className="relative w-full max-w-[17.5rem] overflow-hidden rounded-[0.875rem] bg-[var(--background)] shadow-[0_8px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:max-w-[20rem] sm:rounded-[0.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pb-4 pt-5 text-center sm:px-5 sm:pt-5 sm:text-left">
          <h2
            id="apple-confirm-title"
            className="text-[1.0625rem] font-semibold leading-snug tracking-tight text-[var(--foreground)]"
          >
            {title}
          </h2>
          <p
            id="apple-confirm-message"
            className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]"
          >
            {message}
          </p>
        </div>

        {/* iOS: 세로 스택 + 구분선 */}
        <div className="flex flex-col border-t border-[var(--separator)] sm:hidden">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`touch-manipulation min-h-[2.75rem] w-full px-4 text-[1.0625rem] font-normal transition-colors active:bg-[var(--fill-tertiary)] disabled:opacity-40 ${
              destructive
                ? "font-semibold text-[var(--apple-red)]"
                : "font-semibold text-[var(--apple-blue)]"
            }`}
          >
            {loading ? t("common.processing") : confirm}
          </button>
          <div className="h-px bg-[var(--separator)]" />
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="touch-manipulation min-h-[2.75rem] w-full px-4 text-[1.0625rem] font-semibold text-[var(--apple-blue)] transition-colors active:bg-[var(--fill-tertiary)] disabled:opacity-40"
          >
            {cancel}
          </button>
        </div>

        {/* macOS: 가로 버튼 */}
        <div className="hidden items-center justify-end gap-2 border-t border-[var(--separator)] px-4 py-3 sm:flex">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-[0.4375rem] px-3.5 py-1.5 text-[0.8125rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary)] active:bg-[var(--fill-tertiary)] disabled:opacity-40"
          >
            {cancel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-[0.4375rem] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white transition-colors disabled:opacity-40 ${
              destructive
                ? "bg-[var(--apple-red)] hover:bg-[#e0352b] active:bg-[#c92f26]"
                : "bg-[var(--apple-blue)] hover:bg-[#0071e3] active:bg-[#0066cc]"
            }`}
          >
            {loading ? t("common.processing") : confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
