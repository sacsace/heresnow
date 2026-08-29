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
  const items = [
    { key: "terms", href: termsHref, label: t("legal.terms") },
    { key: "privacy", href: privacyHref, label: t("legal.privacy") },
    { key: "cancellation", href: cancellationHref, label: t("legal.cancellationPolicy") },
    { key: "refund", href: refundHref, label: t("legal.refundPolicy") },
  ] as const;

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
        {items.map((item, idx) => (
          <span
            key={item.key}
            className={
              isStack || idx === items.length - 1
                ? "inline-flex items-center"
                : "inline-flex items-center after:ml-2 after:text-[var(--apple-label-tertiary)] after:content-['·']"
            }
          >
            <Link href={item.href} className={authLink}>
              {item.label}
            </Link>
          </span>
        ))}
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
