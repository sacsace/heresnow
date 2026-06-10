"use client";

import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { cancellationPolicyContent } from "@/lib/legal/cancellationPolicy";

export default function CancellationPolicyPage() {
  return <LegalDocumentView content={cancellationPolicyContent} />;
}
