"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{t("consent.title")}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {t("consent.introLine1")}
        <strong className="font-medium text-zinc-800">{t("consent.introBold")}</strong>
        {t("consent.introLine2")}
      </p>
      <section className="mt-6 space-y-3 rounded-xl border border-zinc-200/80 bg-white p-4 text-sm text-zinc-600">
        <div>
          <p className="font-medium text-zinc-900">{t("consent.sectionItems")}</p>
          <ul className="mt-1 list-inside list-disc">
            <li>{t("consent.item1")}</li>
            <li>{t("consent.item2")}</li>
            <li>{t("consent.item3")}</li>
            <li>{t("consent.item4")}</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-zinc-900">{t("consent.sectionPurpose")}</p>
          <p>{t("consent.purposeText")}</p>
        </div>
        <div>
          <p className="font-medium text-zinc-900">{t("consent.sectionNotCollected")}</p>
          <ul className="mt-1 list-inside list-disc">
            <li>{t("consent.not1")}</li>
            <li>{t("consent.not2")}</li>
          </ul>
        </div>
        <p className="text-xs text-zinc-400">{t("consent.footer")}</p>
      </section>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={() => void agree()}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {loading ? t("common.processing") : t("consent.agree")}
      </button>
    </main>
  );
}
