"use client";

import { useI18n } from "@/components/LanguageProvider";
import { featurePill, trustHero, trustHeroLead, trustHeroTitle } from "@/lib/uiStyles";

type Variant = "employee" | "admin";

export function AttendanceTrustHero({ variant = "employee" }: { variant?: Variant }) {
  const { t } = useI18n();

  const titleKey = variant === "admin" ? "trust.adminTitle" : "trust.employeeTitle";
  const leadKey = variant === "admin" ? "trust.adminLead" : "trust.employeeLead";

  const pills = [
    { icon: "📍", text: t("trust.pillGps") },
    { icon: "🛡️", text: t("trust.pillNoTrack") },
    { icon: "✓", text: t("trust.pillVerified") },
  ] as const;

  return (
    <div className={trustHero}>
      <h2 className={trustHeroTitle}>{t(titleKey)}</h2>
      <p className={trustHeroLead}>{t(leadKey)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--separator)] pt-3">
        {pills.map((p) => (
          <span key={p.text} className={`${featurePill} shrink-0 whitespace-nowrap`}>
            <span aria-hidden className="text-[0.625rem]">
              {p.icon}
            </span>
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
}
