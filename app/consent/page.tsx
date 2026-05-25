"use client";

import { AppLogo } from "@/components/AppLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  authButtonPrimary,
  authCard,
  authError,
  authSubtitle,
  authTitle,
} from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { groupedCard, groupedRow } from "@/lib/uiStyles";
import { signOut } from "next-auth/react";
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
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setLoading(false);
    if (!res.ok) {
      if (res.status === 401 && body.error === "SESSION_INVALID") {
        await signOut({ redirect: false });
        router.replace("/login?session=invalid");
        return;
      }
      setErr(typeof body.message === "string" ? body.message : t("consent.errorSave"));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const blocks = [
    {
      title: t("consent.sectionItems"),
      body: (
        <ul className="mt-1.5 list-inside list-disc space-y-0.5">
          <li>{t("consent.item1")}</li>
          <li>{t("consent.item2")}</li>
          <li>{t("consent.item3")}</li>
          <li>{t("consent.item4")}</li>
        </ul>
      ),
    },
    {
      title: t("consent.sectionPurpose"),
      body: <p className="mt-1">{t("consent.purposeText")}</p>,
    },
    {
      title: t("consent.sectionNotCollected"),
      body: (
        <ul className="mt-1.5 list-inside list-disc space-y-0.5">
          <li>{t("consent.not1")}</li>
          <li>{t("consent.not2")}</li>
        </ul>
      ),
    },
  ];

  return (
    <AuthShell className="!w-[min(100%,34rem)] sm:!w-[34rem]">
      <div className={authCard}>
        <div className="mb-4 flex justify-center sm:mb-5">
          <AppLogo variant="auth" title={t("login.title")} />
        </div>
        <h1 className={`${authTitle} text-left`}>{t("consent.title")}</h1>
        <p className={`${authSubtitle} mt-3 text-left`}>
          {t("consent.introLine1")}
          <strong className="font-semibold text-[var(--foreground)]">{t("consent.introBold")}</strong>
          {t("consent.introLine2")}
        </p>
        <div className={`mt-5 ${groupedCard} text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]`}>
          {blocks.map((b, i) => (
            <div
              key={b.title}
              className={`${groupedRow} ${i < blocks.length - 1 ? "hig-divider" : ""}`}
            >
              <p className="font-semibold text-[var(--foreground)]">{b.title}</p>
              {b.body}
            </div>
          ))}
          <p className={`${groupedRow} text-[0.8125rem] text-[var(--apple-label-tertiary)]`}>
            {t("consent.footer")}
          </p>
        </div>
        {err && <p className={`${authError} mt-4`}>{err}</p>}
        <button
          type="button"
          onClick={() => void agree()}
          disabled={loading}
          className={`${authButtonPrimary} mt-6 bg-[var(--apple-green)] hover:bg-[#30b350] active:bg-[#2da84a]`}
        >
          {loading ? t("common.processing") : t("consent.agree")}
        </button>
      </div>
    </AuthShell>
  );
}
