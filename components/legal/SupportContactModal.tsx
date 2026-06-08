"use client";

import {
  authError,
  authFieldGroup,
  authHint,
  authInput,
  authLabel,
  authTextarea,
} from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { btnPrimary, btnSecondary, successText } from "@/lib/uiStyles";
import { SUPPORT_EMAIL, supportMailtoUrl } from "@/lib/supportContact";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SupportContactModal({ open, onClose }: Props) {
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSent(false);
    setName(session?.user?.name?.trim() ?? "");
    setEmail(session?.user?.email?.trim() ?? "");
    setMessage("");
  }, [open, session?.user?.email, session?.user?.name]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/public/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.error === "mail_not_configured" || j.error === "smtp_not_configured") {
          setError(t("legal.supportMailNotConfigured"));
        } else if (j.error === "rate_limited") {
          setError(t("legal.supportRateLimited"));
        } else if (j.error === "invalid_input") {
          setError(t("legal.supportInvalidInput"));
        } else {
          setError(t("legal.supportFail"));
        }
        return;
      }
      setSent(true);
    } catch {
      setError(t("legal.supportFail"));
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  const mailto = supportMailtoUrl(locale);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
    >
      <button
        type="button"
        aria-label={t("common.cancel")}
        disabled={busy}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/25 backdrop-blur-[6px]"
      />

      <div
        className="relative flex max-h-[min(92dvh,44rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-t-[1rem] bg-[var(--background)] shadow-[0_8px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:max-w-[32rem] sm:rounded-[0.875rem] md:max-w-[36rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--separator)] px-5 py-4 sm:px-7 sm:py-5">
          <h2
            id="support-modal-title"
            className="text-[1.0625rem] font-semibold tracking-tight text-[var(--foreground)]"
          >
            {t("legal.supportModalTitle")}
          </h2>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]">
            {t("legal.supportModalLead")}
          </p>
        </div>

        <div className="overflow-y-auto px-5 py-4 sm:px-7 sm:py-5">
          {sent ? (
            <p className={`${successText} text-[0.875rem] leading-relaxed`}>{t("legal.supportSent")}</p>
          ) : (
            <form id="support-contact-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <div className={authFieldGroup}>
                <label className={authLabel} htmlFor="support-name">
                  {t("legal.supportName")}
                </label>
                <input
                  id="support-name"
                  className={authInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  autoComplete="name"
                />
              </div>
              <div className={authFieldGroup}>
                <span className={authLabel}>{t("legal.supportReplyTo")}</span>
                <p
                  className={`${authInput} cursor-default bg-[var(--fill-tertiary)] text-[var(--foreground)]`}
                  aria-readonly="true"
                >
                  {SUPPORT_EMAIL}
                </p>
              </div>
              <div className={authFieldGroup}>
                <label className={authLabel} htmlFor="support-email">
                  {t("legal.supportContactEmail")}
                </label>
                <input
                  id="support-email"
                  type="email"
                  className={authInput}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </div>
              <div className={authFieldGroup}>
                <label className={authLabel} htmlFor="support-message">
                  {t("legal.supportMessage")}
                </label>
                <textarea
                  id="support-message"
                  className={authTextarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={6}
                  placeholder={t("legal.supportMessagePlaceholder")}
                />
              </div>
              {error && (
                <div>
                  <p className={`${authError} text-left`}>{error}</p>
                  {error === t("legal.supportMailNotConfigured") && (
                    <p className={`${authHint} mt-2 text-left`}>
                      <a href={mailto} className="font-medium text-[var(--apple-blue)] underline-offset-2 hover:underline">
                        {t("legal.supportMailtoFallback")}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </form>
          )}
        </div>

        <div className="flex gap-2 border-t border-[var(--separator)] px-5 py-3 sm:justify-end sm:px-7 sm:py-4">
          <button type="button" className={`${btnSecondary} flex-1 sm:flex-none`} disabled={busy} onClick={onClose}>
            {sent ? t("common.confirm") : t("common.cancel")}
          </button>
          {!sent && (
            <button
              type="submit"
              form="support-contact-form"
              className={`${btnPrimary} flex-1 sm:flex-none`}
              disabled={busy}
            >
              {busy ? t("common.processing") : t("legal.supportSend")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
