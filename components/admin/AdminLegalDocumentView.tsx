"use client";

import { useI18n } from "@/components/LanguageProvider";
import { groupedCard, groupedRow, pageStack, sectionLabel } from "@/lib/uiStyles";
import type { LocalizedLegalDocument } from "@/lib/legal/types";

type Props = {
  content: LocalizedLegalDocument;
};

export function AdminLegalDocumentView({ content }: Props) {
  const { locale, t } = useI18n();
  const doc = content[locale] ?? content.ko;

  return (
    <div className={pageStack}>
      <section>
        <p className={sectionLabel}>{doc.title}</p>
        <div className={groupedCard}>
          <div className={groupedRow}>
            <p className="text-[0.75rem] text-[var(--apple-label-secondary)]">
              {t("legal.lastUpdated").replace("{date}", doc.lastUpdated)}
            </p>
            {doc.intro ? (
              <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--apple-label-secondary)]">
                {doc.intro}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {doc.sections.map((section) => (
        <section key={section.title}>
          <p className={sectionLabel}>{section.title}</p>
          <div className={groupedCard}>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className={`${groupedRow} border-b border-[var(--separator)] last:border-b-0`}>
                {paragraph}
              </p>
            ))}
            {section.bullets?.map((item) => (
              <p key={item} className={`${groupedRow} border-b border-[var(--separator)] last:border-b-0`}>
                · {item}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
