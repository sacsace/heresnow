"use client";

import { AdminLegalDocumentView } from "@/components/admin/AdminLegalDocumentView";
import { termsContent } from "@/lib/legal/terms";

export default function AdminTermsPage() {
  return <AdminLegalDocumentView content={termsContent} />;
}
