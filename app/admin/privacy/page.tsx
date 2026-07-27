"use client";

import { AdminLegalDocumentView } from "@/components/admin/AdminLegalDocumentView";
import { privacyContent } from "@/lib/legal/privacy";

export default function AdminPrivacyPage() {
  return <AdminLegalDocumentView content={privacyContent} />;
}
