import type { Locale } from "@/lib/i18n/dictionaries";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
};

export type LocalizedLegalDocument = Record<Locale, LegalDocument>;
