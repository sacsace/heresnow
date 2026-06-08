"use client";

import { AppLogo } from "@/components/AppLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  authButtonPrimary,
  authCardSignup,
  authShellSignupWidth,
  authError,
  authFieldGroup,
  authFooter,
  authFormSignup,
  authHint,
  authInput,
  authLabel,
  authLink,
  authSelect,
  authSubtitleSignup,
  authTitle,
} from "@/components/auth/authStyles";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { useI18n } from "@/components/LanguageProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import type { BillingPeriod } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  billingPeriod: BillingPeriod;
  priceAmount: number;
  pricePerUser: number;
  currency: string;
  label: string | null;
  trialDays: number | null;
};

const IST_VALUE = "Asia/Kolkata" as const;

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [timezone] = useState<string>(IST_VALUE);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [tierId, setTierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTiers = useCallback(() => {
    void fetch("/api/public/pricing-tiers")
      .then((r) => r.json())
      .then((j: { tiers?: Tier[] }) => {
        const list = (j.tiers ?? []).map((row) => ({
          ...row,
          trialDays: row.trialDays ?? null,
        }));
        setTierId(list[0]?.id ?? "");
      })
      .catch(() => setError(t("signup.errorTiers")));
  }, [t]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await fetch("/api/public/register-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        timezone,
        adminEmail,
        adminPassword,
        pricingTierId: tierId,
        adminName: adminName.trim() || undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      setError(
        typeof j.error === "string"
          ? j.error
          : j.error?.fieldErrors
            ? t("signup.errorInput")
            : t("signup.errorSignup")
      );
      return;
    }
    router.push("/login?registered=1");
  }

  return (
    <AuthShell className={authShellSignupWidth}>
      <div className={authCardSignup}>
        <div className="mb-4 flex justify-center sm:mb-5">
          <AppLogo variant="auth" title={t("login.title")} />
        </div>
        <h1 className={authTitle}>{t("signup.title")}</h1>
        <p className={authSubtitleSignup}>{t("signup.subtitle")}</p>

        <form onSubmit={(e) => void onSubmit(e)} className={authFormSignup}>
          <div className={authFieldGroup}>
            <label className={authLabel}>{t("signup.companyName")}</label>
            <input
              className={authInput}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div className={authFieldGroup}>
            <label className={authLabel}>{t("signup.timezone")}</label>
            <select
              className={authSelect}
              value={timezone}
              disabled
              aria-label={t("signup.timezone")}
            >
              <option value={IST_VALUE}>
                {t("signup.timezoneOption")} ({IST_VALUE})
              </option>
            </select>
            <p className={authHint}>{t("signup.timezoneIndiaOnly")}</p>
          </div>
          <div className={authFieldGroup}>
            <label className={authLabel}>{t("signup.plan")}</label>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--foreground)]">
              {t("signup.planNote")}
            </p>
            <p className={authHint}>{t("signup.planHint")}</p>
          </div>
          <div className={authFieldGroup}>
            <label className={authLabel}>{t("signup.adminDisplayName")}</label>
            <input
              className={authInput}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder={t("signup.adminDisplayPlaceholder")}
            />
          </div>
          <div className={authFieldGroup}>
            <label className={authLabel}>{t("signup.adminEmail")}</label>
            <input
              type="email"
              autoComplete="email"
              className={authInput}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>
          <div className={authFieldGroup}>
            <label className={authLabel}>{t("signup.adminPassword")}</label>
            <input
              type="password"
              autoComplete="new-password"
              className={authInput}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
            <p className={authHint}>{t("signup.adminIsCompanyAdmin")}</p>
          </div>
          {error && <p className={authError}>{error}</p>}
          <button type="submit" disabled={loading || !tierId} className={authButtonPrimary}>
            {loading ? t("common.processing") : t("signup.submit")}
          </button>
        </form>
        <p className={authFooter}>
          {t("signup.hasAccount")}{" "}
          <Link href="/login" className={authLink}>
            {t("signup.loginLink")}
          </Link>
        </p>
        <LegalFooterLinks className="mt-4" />
      </div>
    </AuthShell>
  );
}
