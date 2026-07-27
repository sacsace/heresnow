"use client";

import { AdminLegalDocumentView } from "@/components/admin/AdminLegalDocumentView";
import { refundPolicyContent } from "@/lib/legal/refundPolicy";

export default function AdminRefundPolicyPage() {
  return <AdminLegalDocumentView content={refundPolicyContent} />;
}
