"use client";

import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { refundPolicyContent } from "@/lib/legal/refundPolicy";

export default function RefundPolicyPage() {
  return <LegalDocumentView content={refundPolicyContent} />;
}
