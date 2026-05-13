"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-8">
          <h1 className="text-center text-xl font-semibold tracking-tight text-zinc-900">{t("login.title")}</h1>
          <p className="mt-2 text-center text-sm text-zinc-500">{t("login.subtitle")}</p>
          {registered && (
            <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-center text-sm text-emerald-800">
              {t("login.registered")}
            </p>
          )}
          {dbHint && (
            <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-900">
              {dbHint}
            </p>
          )}
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-600">{t("login.email")}</label>
              <input
                type="email"
                autoComplete="username"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600">{t("login.password")}</label>
              <input
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-500">
            <Link href="/signup" className="font-medium text-sky-600 hover:text-sky-700 hover:underline">
              {t("login.signupLink")}
            </Link>
          </p>
        </div>
      </div>
      <p className="shrink-0 pb-6 pt-2 text-center text-xs text-zinc-400">
        © 2026 Minsub Ventures Private Limited
      </p>
    </main>
  );
}

function LoginLoading() {
  const { t } = useI18n();
  return <div className="p-8 text-center text-sm text-zinc-500">{t("common.loading")}</div>;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
