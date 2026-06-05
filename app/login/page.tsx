"use client";

import { AppLogo } from "@/components/AppLogo";
import { AuthShell } from "@/components/auth/AuthShell";
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
import { useI18n } from "@/components/LanguageProvider";
import { prefetchFaceRecognition } from "@/lib/faceRecognitionClient";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import { signIn } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";

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

  useEffect(() => {
    prefetchFaceRecognition(false);
    void import("@/components/auth/FaceLoginSection");
  }, []);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("login.errorPasswordMinLength"));
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError(t("login.errorCredentials"));
      return;
    }
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

  const shellWidth =
    mode === "face" ? "!w-[26rem] sm:!w-[28rem]" : "!w-[26rem] sm:!w-[27rem]";

  return (
    <AuthShell
      className={shellWidth}
      footer={
        <p className={authCopyright}>
          © 2026 Minsub Ventures Private Limited
        </p>
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

        <div
          className="mt-5 flex rounded-[0.625rem] bg-[var(--fill-secondary)] p-0.5"
          role="tablist"
          aria-label={t("login.submit")}
        >
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
                type="email"
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
