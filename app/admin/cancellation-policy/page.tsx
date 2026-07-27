"use client";

import { AdminLegalDocumentView } from "@/components/admin/AdminLegalDocumentView";
import { cancellationPolicyContent } from "@/lib/legal/cancellationPolicy";

export default function AdminCancellationPolicyPage() {
  return <AdminLegalDocumentView content={cancellationPolicyContent} />;
}
