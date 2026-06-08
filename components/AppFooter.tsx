"use client";

import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { appFooter, appFooterText } from "@/lib/uiStyles";

export function AppFooter() {
  return (
    <footer className={appFooter}>
      <LegalFooterLinks className="mb-2.5" />
      <p className={appFooterText}>
        © 2026{" "}
        <a
          href="https://www.msventures.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-inherit no-underline hover:text-inherit focus:text-inherit"
        >
          Minsub Ventures Private Limited
        </a>
      </p>
    </footer>
  );
}
