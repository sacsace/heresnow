"use client";

import { authLink } from "@/components/auth/authStyles";
import { SupportContactModal } from "@/components/legal/SupportContactModal";
import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";
import { useState } from "react";

type Props = {
  className?: string;
};

function FooterDot() {
  return (
    <span className="text-[var(--apple-label-tertiary)]" aria-hidden>
      ·
    </span>
  );
}

export function LegalFooterLinks({ className = "" }: Props) {
  const { t } = useI18n();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <nav
        className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${className}`}
        aria-label={t("legal.navLabel")}
      >
        <Link href="/terms" className={authLink}>
          {t("legal.terms")}
        </Link>
        <FooterDot />
        <Link href="/privacy" className={authLink}>
          {t("legal.privacy")}
        </Link>
        <FooterDot />
        <Link href="/cancellation-policy" className={authLink}>
          {t("legal.cancellationPolicy")}
        </Link>
        <FooterDot />
        <Link href="/refund-policy" className={authLink}>
          {t("legal.refundPolicy")}
        </Link>
        <FooterDot />
        <button
          type="button"
          className={`${authLink} cursor-pointer border-0 bg-transparent p-0`}
          onClick={() => setSupportOpen(true)}
        >
          {t("legal.support")}
        </button>
      </nav>
      <SupportContactModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
