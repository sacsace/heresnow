"use client";

import { useI18n } from "@/components/LanguageProvider";
import { authButtonPrimary, authError, authFieldGroup, authInput, authLabel } from "@/components/auth/authStyles";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useMemo, useState } from "react";

type Props = {
  callbackUrl: string;
  disabled?: boolean;
  error?: string | null;
  onLoadingChange: (v: boolean) => void;
  onError: (message: string | null) => void;
};

export function PasskeyLoginSection({
  callbackUrl,
  disabled,
  error,
  onLoadingChange,
  onError,
}: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const supported = useMemo(
    () => typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined",
    []
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    if (!supported) {
      onError(t("login.passkeyNoSupport"));
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      onError(t("login.errorCredentials"));
      return;
    }

    onLoadingChange(true);
    try {
      const optionsRes = await fetch("/api/public/passkey-login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const optionsJson = (await optionsRes.json().catch(() => ({}))) as {
        error?: string;
      } & Record<string, unknown>;
      if (!optionsRes.ok) {
        if (optionsJson.error === "NO_PASSKEY") {
          onError(t("login.passkeyNoPasskey"));
        } else {
          onError(t("login.passkeyFailed"));
        }
        return;
      }

      const authenticationResponse = await startAuthentication(
        optionsJson as unknown as Parameters<typeof startAuthentication>[0]
      );
      const verifyRes = await fetch("/api/public/passkey-login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authenticationResponse }),
      });
      const verifyJson = (await verifyRes.json().catch(() => ({}))) as {
        loginToken?: string;
        error?: string;
      };
      if (!verifyRes.ok || !verifyJson.loginToken) {
        onError(t("login.passkeyFailed"));
        return;
      }

      const signInRes = await signIn("passkey-login", {
        loginToken: verifyJson.loginToken,
        redirect: false,
        callbackUrl,
      });
      if (signInRes?.error) {
        onError(t("login.errorCredentials"));
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      onError(t("login.passkeyFailed"));
    } finally {
      onLoadingChange(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-[0.8125rem] text-[var(--apple-label-secondary)]">{t("login.passkeyLead")}</p>
      <div className={authFieldGroup}>
        <label className={authLabel}>{t("login.email")}</label>
        <input
          type="text"
          inputMode="email"
          autoComplete="username webauthn"
          className={authInput}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      {error ? <p className={authError}>{error}</p> : null}
      {!supported ? <p className={authError}>{t("login.passkeyNoSupport")}</p> : null}
      <button type="submit" disabled={disabled || !supported} className={authButtonPrimary}>
        {disabled ? t("login.passkeyChecking") : t("login.passkeySubmit")}
      </button>
    </form>
  );
}

