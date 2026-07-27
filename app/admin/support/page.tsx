"use client";

import { SupportContactModal } from "@/components/legal/SupportContactModal";
import { useI18n } from "@/components/LanguageProvider";
import { btnPrimary, groupedCard, groupedRow, hint, pageStack, sectionLabel } from "@/lib/uiStyles";
import { useState } from "react";

export default function AdminSupportPage() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className={pageStack}>
      <section>
        <p className={sectionLabel}>{t("legal.support")}</p>
        <div className={groupedCard}>
          <div className={groupedRow}>
            <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
              {t("legal.supportModalTitle")}
            </p>
            <p className={`mt-1.5 ${hint}`}>{t("legal.supportModalLead")}</p>
            <button type="button" className={`mt-4 ${btnPrimary}`} onClick={() => setOpen(true)}>
              {t("legal.supportSend")}
            </button>
          </div>
        </div>
      </section>
      <SupportContactModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
