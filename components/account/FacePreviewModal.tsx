"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  btnActionEqual,
  btnActionRow,
  btnPrimary,
  btnSecondary,
  errorText,
  hint,
  input,
  label,
} from "@/lib/uiStyles";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  hasPreview: boolean;
  credentialId?: string | null;
};

export function FacePreviewModal({ open, onClose, hasPreview, credentialId }: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
      setPreviewUrl(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError(t("account.errCurrentRequired"));
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/employee/face/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(credentialId ? { credentialId } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        previewUrl?: string;
      };
      if (r.ok && j.previewUrl) {
        setPreviewUrl(j.previewUrl);
        setPassword("");
        return;
      }
      switch (j.error) {
        case "PASSWORD_WRONG":
          setError(t("account.errCurrentWrong"));
          break;
        case "NO_PREVIEW":
          setError(t("account.facePreviewMissing"));
          break;
        case "NOT_ENROLLED":
          setError(t("account.faceStatusNotEnrolled"));
          break;
        case "RATE_LIMITED":
          setError(t("account.facePreviewRateLimited"));
          break;
        default:
          setError(t("account.facePreviewLoadFail"));
      }
    } catch {
      setError(t("account.facePreviewLoadFail"));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--grouped-bg)] shadow-xl ring-1 ring-black/[0.08]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="face-preview-title"
      >
        <div className="border-b border-[var(--separator)] px-5 py-4">
          <p id="face-preview-title" className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
            {t("account.faceViewTitle")}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
            {previewUrl ? t("account.faceViewShownLead") : t("account.faceViewPasswordLead")}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!hasPreview && !previewUrl ? (
            <p className={hint}>{t("account.facePreviewMissing")}</p>
          ) : previewUrl ? (
            <div className="overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t("account.faceViewTitle")}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className={label} htmlFor="face-preview-password">
                  {t("account.currentPassword")}
                </label>
                <input
                  id="face-preview-password"
                  type="password"
                  autoComplete="current-password"
                  className={`${input} mt-1.5`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              {error && <p className={errorText}>{error}</p>}
              <div className={btnActionRow}>
                <button type="submit" disabled={busy} className={`${btnPrimary} ${btnActionEqual}`}>
                  {busy ? t("account.facePreviewLoading") : t("account.faceViewConfirm")}
                </button>
                <button
                  type="button"
                  className={`${btnSecondary} ${btnActionEqual}`}
                  onClick={onClose}
                  disabled={busy}
                >
                  {t("account.faceViewClose")}
                </button>
              </div>
            </form>
          )}

          {previewUrl && (
            <button type="button" className={`${btnSecondary} ${btnActionEqual}`} onClick={onClose}>
              {t("account.faceViewClose")}
            </button>
          )}

          {!hasPreview && !previewUrl && (
            <button type="button" className={`${btnSecondary} ${btnActionEqual}`} onClick={onClose}>
              {t("account.faceViewClose")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
