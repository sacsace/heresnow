"use client";

import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { privacyContent } from "@/lib/legal/privacy";

export default function PrivacyPage() {
  return <LegalDocumentView content={privacyContent} />;
}
