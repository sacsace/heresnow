"use client";

import { AppLogo } from "@/components/AppLogo";
import {
  authLink,
  consentCard,
  consentFooter,
  consentIntro,
  consentRow,
  consentRowDivider,
  consentRowSecondary,
  consentSectionLabel,
  consentSectionsStack,
  consentTitle,
} from "@/components/auth/authStyles";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { useI18n } from "@/components/LanguageProvider";
import { appFooterText } from "@/lib/uiStyles";
import type { LocalizedLegalDocument } from "@/lib/legal/types";
import Link from "next/link";

type Props = {
  content: LocalizedLegalDocument;
};

export function LegalDocumentView({ content }: Props) {
  const { locale, t } = useI18n();
  const doc = content[locale] ?? content.ko;

  return (
    <LegalPageShell
      footer={
        <div className="text-center">
          <LegalFooterLinks className="mb-2.5" />
          <p className={appFooterText}>© 2026 Minsub Ventures Private Limited</p>
        </div>
      }
    >
      <article className={consentCard}>
        <div className="mb-4 flex justify-center sm:mb-5">
          <AppLogo variant="auth" title="HeresNow" />
        </div>
        <h1 className={consentTitle}>{doc.title}</h1>
        <p className={consentIntro}>
          {t("legal.lastUpdated").replace("{date}", doc.lastUpdated)}
        </p>
        {doc.intro ? <p className={`${consentIntro} mt-3`}>{doc.intro}</p> : null}

        <div className={consentSectionsStack}>
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className={consentSectionLabel}>{section.title}</h2>
              <div className="overflow-hidden rounded-xl bg-[var(--fill-tertiary)] ring-1 ring-black/[0.04]">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className={`${consentRowSecondary} ${consentRowDivider}`}>
                    {paragraph}
                  </p>
                ))}
                {section.bullets?.map((item) => (
                  <p key={item} className={`${consentRow} ${consentRowDivider}`}>
                    · {item}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className={consentFooter}>{t("legal.documentFooter")}</p>

        <p className="mt-6 text-center text-[0.8125rem] sm:text-[0.875rem]">
          <Link href="/login" className={authLink}>
            {t("legal.backToLogin")}
          </Link>
        </p>
      </article>
    </LegalPageShell>
  );
}
