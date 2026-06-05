"use client";

import { AppLogo } from "@/components/AppLogo";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  authButtonPrimary,
  authError,
  consentActions,
  consentCard,
  consentFooter,
  consentIntro,
  consentList,
  consentPrivacyBanner,
  consentPrivacyBannerText,
  consentRow,
  consentRowDivider,
  consentRowSecondary,
  consentSectionsStack,
  consentSectionLabel,
  consentShellWidth,
  consentTitle,
} from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

function ShieldIcon() {
  return (
    <svg
      aria-hidden
      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--apple-blue)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 20 6.5V11c0 4.4-3.2 8.5-8 10.5C6.2 19.5 3 15.4 3 11V6.5L12 3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      className="h-3 w-3"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function ConsentListRow({ children, secondary }: { children: ReactNode; secondary?: boolean }) {
  return (
    <li className={`${secondary ? consentRowSecondary : consentRow} ${consentRowDivider}`}>
      {children}
    </li>
  );
}

function ConsentCheckRow({ children }: { children: ReactNode }) {
  return (
    <li className={`flex items-start gap-3 ${consentRowSecondary} ${consentRowDivider}`}>
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--apple-green)_16%,transparent)] text-[var(--apple-green)]"
        aria-hidden
      >
        <CheckIcon />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function ConsentSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h2 className={consentSectionLabel}>{label}</h2>
      {children}
    </section>
  );
}

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

  const collectedItems = [
    t("consent.item1"),
    t("consent.item2"),
    t("consent.item3"),
    t("consent.item4"),
  ];
  const notCollectedItems = [t("consent.not1"), t("consent.not2")];

  return (
    <AuthShell className={consentShellWidth}>
      <div className={consentCard}>
        <div className="mb-6 flex justify-center sm:mb-7">
          <AppLogo variant="auth" title={t("login.title")} />
        </div>

        <h1 className={consentTitle}>{t("consent.title")}</h1>
        <p className={consentIntro}>{t("consent.introLine1")}</p>

        <div className={consentPrivacyBanner} role="note">
          <ShieldIcon />
          <p className={consentPrivacyBannerText}>{t("consent.introBold")}</p>
        </div>

        <div className={consentSectionsStack}>
          <ConsentSection label={t("consent.sectionItems")}>
            <ul className={consentList}>
              {collectedItems.map((item) => (
                <ConsentListRow key={item}>{item}</ConsentListRow>
              ))}
            </ul>
          </ConsentSection>

          <ConsentSection label={t("consent.sectionPurpose")}>
            <div className={consentList}>
              <p className={`${consentRowSecondary} ${consentRowDivider}`}>
                {t("consent.purposeText")}
              </p>
            </div>
          </ConsentSection>

          <ConsentSection label={t("consent.sectionNotCollected")}>
            <ul className={consentList}>
              {notCollectedItems.map((item) => (
                <ConsentCheckRow key={item}>{item}</ConsentCheckRow>
              ))}
            </ul>
          </ConsentSection>
        </div>

        <p className={consentFooter}>{t("consent.footer")}</p>

        {err && <p className={`${authError} mt-4`}>{err}</p>}

        <div className={consentActions}>
          <button
            type="button"
            onClick={() => void agree()}
            disabled={loading}
            className={authButtonPrimary}
          >
            {loading ? t("common.processing") : t("consent.agree")}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
