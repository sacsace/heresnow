"use client";

import { AppleConfirmDialog } from "@/components/ui/AppleConfirmDialog";
import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useRef, useState } from "react";

export type AppleConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * window.confirm 대체 — AppleConfirmDialog 로 통일된 Promise 확인 UI.
 * 사용: const { confirm, dialog } = useAppleConfirm(); … {dialog}
 */
export function useAppleConfirm() {
  const { t } = useI18n();
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<AppleConfirmOptions>({
    title: "",
    message: "",
  });

  const close = useCallback((ok: boolean) => {
    setOpen(false);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(ok);
  }, []);

  const confirm = useCallback((options: AppleConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (resolveRef.current) {
        resolveRef.current(false);
      }
      resolveRef.current = resolve;
      setOpts(options);
      setOpen(true);
    });
  }, []);

  const dialog = (
    <AppleConfirmDialog
      open={open}
      title={opts.title}
      message={opts.message}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel ?? t("common.cancel")}
      destructive={opts.destructive}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
