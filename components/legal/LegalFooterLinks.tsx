"use client";

import { authLink } from "@/components/auth/authStyles";
import { SupportContactModal } from "@/components/legal/SupportContactModal";
import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Props = {
  className?: string;
  layout?: "inline" | "stack";
  wrap?: boolean;
};

function FooterDot() {
  return (
    <span className="text-[var(--apple-label-tertiary)]" aria-hidden>
      ·
    </span>
  );
}

export function LegalFooterLinks({ className = "", layout = "inline", wrap = true }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [supportOpen, setSupportOpen] = useState(false);
  const isStack = layout === "stack";
  const inAdmin = pathname.startsWith("/admin");
  const termsHref = inAdmin ? "/admin/terms" : "/terms";
  const privacyHref = inAdmin ? "/admin/privacy" : "/privacy";
  const cancellationHref = inAdmin ? "/admin/cancellation-policy" : "/cancellation-policy";
  const refundHref = inAdmin ? "/admin/refund-policy" : "/refund-policy";
  const supportHref = inAdmin ? "/admin/support" : null;

  return (
    <>
      <nav
        className={
          isStack
            ? `flex flex-col items-start gap-y-1.5 ${className}`
            : `flex ${wrap ? "flex-wrap gap-y-1" : "flex-nowrap whitespace-nowrap"} items-center justify-center gap-x-2 ${className}`
        }
        aria-label={t("legal.navLabel")}
      >
        <Link href={termsHref} className={authLink}>
          {t("legal.terms")}
        </Link>
        {!isStack && <FooterDot />}
        <Link href={privacyHref} className={authLink}>
          {t("legal.privacy")}
        </Link>
        {!isStack && <FooterDot />}
        <Link href={cancellationHref} className={authLink}>
          {t("legal.cancellationPolicy")}
        </Link>
        {!isStack && <FooterDot />}
        <Link href={refundHref} className={authLink}>
          {t("legal.refundPolicy")}
        </Link>
        {!isStack && <FooterDot />}
        {supportHref ? (
          <Link href={supportHref} className={authLink}>
            {t("legal.support")}
          </Link>
        ) : (
          <button
            type="button"
            className={`${authLink} cursor-pointer border-0 bg-transparent p-0`}
            onClick={() => setSupportOpen(true)}
          >
            {t("legal.support")}
          </button>
        )}
      </nav>
      {!supportHref && <SupportContactModal open={supportOpen} onClose={() => setSupportOpen(false)} />}
    </>
  );
}
