"use client";

import { useI18n } from "@/components/LanguageProvider";
import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  inputClassName: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2.5 12C4.5 7.5 8 5 12 5s7.5 2.5 9.5 7c-2 4.5-5.5 7-9.5 7s-7.5-2.5-9.5-7Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.5 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.3-1M6.7 6.8C8.4 5.6 10.1 5 12 5c4 0 7.5 2.5 9.5 7a10.8 10.8 0 0 1-2.1 3.1M9.9 5.2A10.7 10.7 0 0 1 12 5c4 0 7.5 2.5 9.5 7a10.8 10.8 0 0 1-1.6 2.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PasswordInput({ inputClassName, className, disabled, ...props }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className ?? ""}`.trim()}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`${inputClassName} pr-11`}
      />
      <button
        type="button"
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--apple-label-secondary)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("login.hidePassword") : t("login.showPassword")}
        aria-pressed={visible}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
