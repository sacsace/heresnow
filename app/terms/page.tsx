"use client";

import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { termsContent } from "@/lib/legal/terms";

export default function TermsPage() {
  return <LegalDocumentView content={termsContent} />;
}
