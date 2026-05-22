"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import {
  authButtonPrimary,
  authCard,
  authError,
  authSubtitle,
  authTitle,
} from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ConsentPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function agree() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/user/consent", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setErr(t("consent.errorSave"));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell className="max-w-lg">
      <div className={authCard}>
        <h1 className={`${authTitle} text-left`}>{t("consent.title")}</h1>
        <p className={`${authSubtitle} mt-3 text-left`}>
          {t("consent.introLine1")}
          <strong className="font-semibold text-[#1d1d1f]">{t("consent.introBold")}</strong>
          {t("consent.introLine2")}
        </p>
        <section className="mt-6 space-y-4 rounded-[0.625rem] bg-[#787880]/[0.08] p-4 text-[0.9375rem] leading-relaxed text-[#3c3c43]/90">
          <div>
            <p className="font-semibold text-[#1d1d1f]">{t("consent.sectionItems")}</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              <li>{t("consent.item1")}</li>
              <li>{t("consent.item2")}</li>
              <li>{t("consent.item3")}</li>
              <li>{t("consent.item4")}</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f]">{t("consent.sectionPurpose")}</p>
            <p className="mt-1">{t("consent.purposeText")}</p>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f]">{t("consent.sectionNotCollected")}</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              <li>{t("consent.not1")}</li>
              <li>{t("consent.not2")}</li>
            </ul>
          </div>
          <p className="text-[0.8125rem] text-[#3c3c43]/55">{t("consent.footer")}</p>
        </section>
        {err && <p className={`${authError} mt-4`}>{err}</p>}
        <button
          type="button"
          onClick={() => void agree()}
          disabled={loading}
          className={`${authButtonPrimary} mt-6 bg-[#34c759] hover:bg-[#30b350] active:bg-[#2da84a]`}
        >
          {loading ? t("common.processing") : t("consent.agree")}
        </button>
      </div>
    </AuthShell>
  );
}
