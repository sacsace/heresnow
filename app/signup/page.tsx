"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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

  const fieldClass =
    "mt-2 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100";
  const labelClass = "block text-base font-medium text-zinc-700";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-12 sm:px-8 sm:py-16">
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-10 shadow-sm sm:p-12 md:p-14">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {t("signup.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-base leading-relaxed text-zinc-500 sm:text-lg">
          {t("signup.subtitle")}
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-10 space-y-6 sm:mt-12 sm:space-y-7">
          <div>
            <label className={labelClass}>{t("signup.companyName")}</label>
            <input
              className={fieldClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.timezone")}</label>
            <select
              className={fieldClass}
              value={timezone}
              disabled
              aria-label={t("signup.timezone")}
            >
              <option value={IST_VALUE}>
                {t("signup.timezoneOption")} ({IST_VALUE})
              </option>
            </select>
            <p className="mt-2 text-sm text-zinc-400">{t("signup.timezoneIndiaOnly")}</p>
          </div>
          <div>
            <label className={labelClass}>{t("signup.plan")}</label>
            <select
              className={fieldClass}
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
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("signup.planHint")}</p>
          </div>
          <div>
            <label className={labelClass}>{t("signup.adminDisplayName")}</label>
            <input
              className={fieldClass}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder={t("signup.adminDisplayPlaceholder")}
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.adminEmail")}</label>
            <input
              type="email"
              autoComplete="email"
              className={fieldClass}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("signup.adminPassword")}</label>
            <input
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{t("signup.adminIsCompanyAdmin")}</p>
          </div>
          {error && <p className="text-base text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !tierId}
            className="w-full rounded-xl bg-sky-500 py-4 text-base font-semibold text-white hover:bg-sky-600 disabled:opacity-50 sm:text-lg"
          >
            {loading ? t("common.processing") : t("signup.submit")}
          </button>
        </form>
        <p className="mt-8 text-center text-base text-zinc-500 sm:mt-10">
          {t("signup.hasAccount")}{" "}
          <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
            {t("signup.loginLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
