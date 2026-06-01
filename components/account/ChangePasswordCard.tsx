"use client";

import { useI18n } from "@/components/LanguageProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import {
  bannerSuccess,
  btnPrimary,
  card,
  cardBody,
  cardHeader,
  errorText,
  hint,
  input,
  label,
} from "@/lib/uiStyles";
import { useState } from "react";

export function ChangePasswordCard() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!current) {
      setError(t("account.errCurrentRequired"));
      return;
    }
    if (!next) {
      setError(t("account.errNewRequired"));
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(t("account.errMinLength"));
      return;
    }
    if (next !== confirm) {
      setError(t("account.errMismatch"));
      return;
    }
    if (next === current) {
      setError(t("account.errSameAsCurrent"));
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        reset();
        setSuccess(t("account.successTitle"));
      } else {
        switch (j.error) {
          case "CURRENT_PASSWORD_WRONG":
            setError(t("account.errCurrentWrong"));
            break;
          case "SAME_AS_CURRENT":
            setError(t("account.errSameAsCurrent"));
            break;
          case "INVALID_INPUT":
            setError(t("account.errMinLength"));
            break;
          default:
            setError(t("account.errGeneric"));
        }
      }
    } catch {
      setError(t("account.errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
          {t("account.changePasswordTitle")}
        </p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
          {t("account.changePasswordLead")}
        </p>
      </div>
      <form className={`${cardBody} space-y-4`} onSubmit={onSubmit} autoComplete="off">
        <div>
          <label className={label} htmlFor="current-password">
            {t("account.currentPassword")}
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className={`${input} mt-1.5`}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        <div>
          <label className={label} htmlFor="new-password">
            {t("account.newPassword")}
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            className={`${input} mt-1.5`}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={busy}
            required
          />
          <p className={`mt-1.5 ${hint}`}>{t("account.passwordHint")}</p>
        </div>
        <div>
          <label className={label} htmlFor="confirm-password">
            {t("account.confirmPassword")}
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            className={`${input} mt-1.5`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        {error && <p className={errorText}>{error}</p>}
        {success && (
          <div className={bannerSuccess}>
            <p className="font-semibold">{success}</p>
            <p className="mt-0.5 text-[0.8125rem]">{t("account.successLead")}</p>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy}
            className={`${btnPrimary} w-full sm:w-auto`}
          >
            {busy ? t("account.submitting") : t("account.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
