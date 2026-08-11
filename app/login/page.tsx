"use client";

import { AppLogo } from "@/components/AppLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import { AppleConfirmDialog } from "@/components/ui/AppleConfirmDialog";
import {
  authBannerSuccess,
  authBannerWarning,
  authButtonPrimary,
  authCardLogin,
  authCopyright,
  authError,
  authFieldGroup,
  authFooter,
  authFormLogin,
  authInput,
  authLabel,
  authLink,
  authSubtitleLogin,
} from "@/components/auth/authStyles";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { useI18n } from "@/components/LanguageProvider";
import { prefetchFaceRecognition } from "@/lib/faceRecognitionClient";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import { signIn } from "next-auth/react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect, useMemo, useRef } from "react";

const FaceLoginSection = dynamic(
  () => import("@/components/auth/FaceLoginSection").then((m) => m.FaceLoginSection),
  {
    ssr: false,
    loading: () => (
      <p className="text-center text-[0.8125rem] text-[var(--apple-label-secondary)]">…</p>
    ),
  }
);

type LoginMode = "password" | "face";

function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const registered = searchParams.get("registered") === "1";
  const sessionInvalid = searchParams.get("session") === "invalid";
  const seatLimitError = searchParams.get("error") === "SeatLimit";
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbHint, setDbHint] = useState<string | null>(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const enrollDecisionRef = useRef<((ok: boolean) => void) | null>(null);
  const isMobileOrTablet = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    const uaMobile =
      /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/.test(ua);
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const touchCapable = (window.navigator.maxTouchPoints ?? 0) > 0;
    return uaMobile || (coarsePointer && touchCapable);
  }, []);
  const passkeySupported = useMemo(
    () => typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined",
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/health")
      .then(async (r) => {
        if (r.status === 404 || cancelled) return;
        const data = (await r.json()) as { ok?: boolean; users?: number };
        if (cancelled) return;
        if (data.ok === false) {
          setDbHint(t("login.dbUnreachable"));
          return;
        }
        if (typeof data.users === "number" && data.users === 0) {
          setDbHint(t("login.dbNoUsers"));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    return () => {
      if (enrollDecisionRef.current) {
        enrollDecisionRef.current(false);
        enrollDecisionRef.current = null;
      }
    };
  }, []);

  async function askPasskeyEnroll(): Promise<boolean> {
    setEnrollDialogOpen(true);
    return new Promise<boolean>((resolve) => {
      enrollDecisionRef.current = resolve;
    });
  }

  function resolvePasskeyEnrollDecision(ok: boolean) {
    setEnrollDialogOpen(false);
    if (!enrollDecisionRef.current) return;
    const resolve = enrollDecisionRef.current;
    enrollDecisionRef.current = null;
    resolve(ok);
  }

  async function registerPasskeyAfterLogin(normalizedEmail: string) {
    if (!passkeySupported || !isMobileOrTablet) return;
    const shouldEnroll = await askPasskeyEnroll();
    if (!shouldEnroll) return;
    try {
      const optionsRes = await fetch("/api/user/passkeys/register/options", { method: "POST" });
      const optionsJson = (await optionsRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!optionsRes.ok) return;
      const registrationResponse = await startRegistration(
        optionsJson as unknown as Parameters<typeof startRegistration>[0]
      );
      await fetch("/api/user/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: registrationResponse, nickname: normalizedEmail }),
      });
    } catch {
      /* 로그인 흐름 차단하지 않음 */
    }
  }

  async function onPasskeyLogin() {
    setError(null);
    if (!passkeySupported) {
      setError(t("login.passkeyNoSupport"));
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t("login.passkeyEmailRequired"));
      return;
    }

    setLoading(true);
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
          setError(t("login.passkeyNoPasskey"));
        } else {
          setError(t("login.passkeyFailed"));
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
      };
      if (!verifyRes.ok || !verifyJson.loginToken) {
        setError(t("login.passkeyFailed"));
        return;
      }

      const signInRes = await signIn("passkey-login", {
        loginToken: verifyJson.loginToken,
        redirect: false,
        callbackUrl,
      });
      if (signInRes?.error) {
        setError(t("login.errorCredentials"));
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError(t("login.passkeyFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("login.errorPasswordMinLength"));
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const res = await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError(t("login.errorCredentials"));
      return;
    }
    await registerPasskeyAfterLogin(normalizedEmail);
    window.location.href = callbackUrl;
  }

  function switchMode(next: LoginMode) {
    if (next === mode) return;
    if (next === "face") {
      prefetchFaceRecognition(true);
      void import("@/components/auth/FaceLoginSection");
    }
    setMode(next);
    setError(null);
  }

  function warmFaceLogin() {
    prefetchFaceRecognition(true);
    void import("@/components/auth/FaceLoginSection");
  }

  const shellWidth = mode === "face" ? "!w-[26rem] sm:!w-[28rem]" : "!w-[26rem] sm:!w-[27rem]";

  return (
    <AuthShell
      className={shellWidth}
      footer={
        <div className="pointer-events-auto text-center">
          <LegalFooterLinks wrap={false} className="mb-2 max-w-full text-[0.6875rem] sm:text-[0.75rem]" />
          <p className={authCopyright}>© 2026 Minsub Ventures Private Limited</p>
        </div>
      }
    >
      <div className={authCardLogin}>
        <div className="mb-4 flex justify-center sm:mb-5">
          <AppLogo variant="auth" title={t("login.title")} />
        </div>
        <p className={authSubtitleLogin}>{t("login.subtitle")}</p>
        {registered && <p className={`${authBannerSuccess} mt-4`}>{t("login.registered")}</p>}
        {sessionInvalid && <p className={authBannerWarning}>{t("login.sessionInvalid")}</p>}
        {seatLimitError && <p className={authBannerWarning}>{t("login.errorSeatLimit")}</p>}
        {dbHint && <p className={authBannerWarning}>{dbHint}</p>}

        <div className="mt-5 flex rounded-[0.625rem] bg-[var(--fill-secondary)] p-0.5" role="tablist" aria-label={t("login.submit")}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "password"}
            className={`flex-1 rounded-[0.5rem] py-2 text-[0.8125rem] font-medium transition-colors sm:text-[0.875rem] ${
              mode === "password"
                ? "bg-[var(--grouped-bg)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--apple-label-secondary)]"
            }`}
            onClick={() => switchMode("password")}
          >
            {t("login.modePassword")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "face"}
            className={`flex-1 rounded-[0.5rem] py-2 text-[0.8125rem] font-medium transition-colors sm:text-[0.875rem] ${
              mode === "face"
                ? "bg-[var(--grouped-bg)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--apple-label-secondary)]"
            }`}
            onMouseEnter={warmFaceLogin}
            onFocus={warmFaceLogin}
            onClick={() => switchMode("face")}
          >
            {t("login.modeFace")}
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={onSubmit} className={authFormLogin}>
            <div className={authFieldGroup}>
              <label className={authLabel}>{t("login.email")}</label>
              <input
                type="text"
                inputMode="email"
                autoComplete="username"
                className={authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={authFieldGroup}>
              <label className={authLabel}>{t("login.password")}</label>
              <input
                type="password"
                autoComplete="current-password"
                className={authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="mt-1 text-[0.75rem] text-[var(--apple-label-secondary)]">
                {t("login.passwordHint")}
              </p>
            </div>
            {error && <p className={authError}>{error}</p>}
            <button type="submit" disabled={loading} className={authButtonPrimary}>
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
            {isMobileOrTablet ? (
              <>
                <button
                  type="button"
                  disabled={loading || !passkeySupported}
                  className="w-full rounded-[0.625rem] border border-[var(--separator)] bg-[var(--fill-secondary)] py-2 text-[0.875rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary-hover)] disabled:opacity-50 sm:text-[0.9375rem]"
                  onClick={() => void onPasskeyLogin()}
                >
                  {loading ? t("login.passkeyChecking") : t("login.passkeySubmit")}
                </button>
                {!passkeySupported ? (
                  <p className="text-center text-[0.75rem] text-[var(--apple-label-secondary)]">
                    {t("login.passkeyNoSupport")}
                  </p>
                ) : null}
              </>
            ) : null}
          </form>
        ) : (
          <div className={authFormLogin}>
            <FaceLoginSection
              callbackUrl={callbackUrl}
              disabled={loading}
              error={error}
              onLoadingChange={setLoading}
              onError={setError}
            />
          </div>
        )}

        <p className={`${authFooter} mt-6`}>
          <Link href="/signup" className={authLink}>
            {t("login.signupLink")}
          </Link>
        </p>
      </div>
      <AppleConfirmDialog
        open={enrollDialogOpen}
        title={t("login.passkeyEnrollTitle")}
        message={t("login.passkeyEnrollAsk")}
        confirmLabel={t("login.passkeyEnrollConfirm")}
        cancelLabel={t("login.passkeyEnrollSkip")}
        onConfirm={() => resolvePasskeyEnrollDecision(true)}
        onCancel={() => resolvePasskeyEnrollDecision(false)}
      />
    </AuthShell>
  );
}

function LoginLoading() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center text-[0.8125rem] text-[var(--apple-label-secondary)]">
      {t("common.loading")}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
