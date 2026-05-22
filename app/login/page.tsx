"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  authBannerSuccess,
  authBannerWarning,
  authButtonPrimary,
  authCard,
  authError,
  authFieldGroup,
  authFooter,
  authForm,
  authInput,
  authLabel,
  authLink,
  authSubtitle,
  authTitle,
} from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";

function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbHint, setDbHint] = useState<string | null>(null);

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

  return (
    <AuthShell
      footer={
        <p className="shrink-0 pb-6 pt-4 text-center text-[0.8125rem] text-[#3c3c43]/45">
          © 2026 Minsub Ventures Private Limited
        </p>
      }
    >
      <div className={authCard}>
        <h1 className={authTitle}>{t("login.title")}</h1>
        <p className={authSubtitle}>{t("login.subtitle")}</p>
        {registered && <p className={authBannerSuccess}>{t("login.registered")}</p>}
        {dbHint && <p className={authBannerWarning}>{dbHint}</p>}
        <form onSubmit={onSubmit} className={authForm}>
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
              required
            />
          </div>
          {error && <p className={authError}>{error}</p>}
          <button type="submit" disabled={loading} className={authButtonPrimary}>
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
        <p className={authFooter}>
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
    <div className="flex flex-1 items-center justify-center p-8 text-center text-[0.9375rem] text-[#3c3c43]/60">
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
