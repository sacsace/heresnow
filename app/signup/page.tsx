"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  authButtonPrimary,
  authCard,
  authError,
  authFieldGroup,
  authFooter,
  authForm,
  authHint,
  authInput,
  authLabel,
  authLink,
  authSelect,
  authSubtitle,
  authTitle,
} from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  pricePerYear: number;
  currency: string;
  label: string | null;
  trialDays: number | null;
};

const IST_VALUE = "Asia/Kolkata" as const;

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [timezone] = useState<string>(IST_VALUE);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [tierId, setTierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/public/pricing-tiers")
      .then((r) => r.json())
      .then((j: { tiers?: Tier[] }) => {
        const list = (j.tiers ?? []).map((row) => ({
          ...row,
          trialDays: row.trialDays ?? null,
        }));
        setTiers(list);
        if (list[0]) setTierId(list[0].id);
      })
      .catch(() => setError(t("signup.errorTiers")));
  }, [t]);

  function tierLabelLine(tr: Tier) {
    if (tr.trialDays != null && tr.trialDays > 0) {
      return t("signup.tierTrialLine").replace("{seats}", String(tr.maxSeats)).replace("{days}", String(tr.trialDays));
    }
    if (tr.label) {
      return `${tr.label} — Rs.${tr.pricePerYear}${t("signup.tierSuffix")} (${tr.currency})`;
    }
    const range = `${tr.minSeats}–${tr.maxSeats}${t("signup.seats")}`;
    return `${range} — Rs.${tr.pricePerYear}${t("signup.tierSuffix")} (${tr.currency})`;
  }

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
    <AuthShell className="max-w-lg sm:max-w-xl">
      <div className={authCard}>
        <h1 className={authTitle}>{t("signup.title")}</h1>
        <p className={authSubtitle}>{t("signup.subtitle")}</p>

        <form onSubmit={(e) => void onSubmit(e)} className={authForm}>
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
              className={`${authSelect} auth-select-chevron`}
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
            <select
              className={`${authSelect} auth-select-chevron`}
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              required
            >
              {tiers.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tierLabelLine(tr)}
                </option>
              ))}
            </select>
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
              minLength={8}
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
      </div>
    </AuthShell>
  );
}
