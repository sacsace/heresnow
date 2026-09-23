"use client";

import type { ReactNode } from "react";

export type AppleDialogVariant = "default" | "warning" | "success";

export function AppleDialogBackdrop({
  onClose,
  disabled,
  ariaLabel,
}: {
  onClose: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClose}
      className="absolute inset-0 h-full w-full bg-black/35 backdrop-blur-[10px] transition-opacity"
    />
  );
}

export function AppleDialogPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full max-w-[20rem] overflow-hidden rounded-[1.125rem] bg-[var(--background)] shadow-[0_12px_48px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.08] dark:ring-white/[0.08] sm:max-w-[22rem] ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DialogIcon({ variant }: { variant: AppleDialogVariant }) {
  if (variant === "default") return null;

  const isSuccess = variant === "success";
  const bg = isSuccess ? "bg-[var(--apple-green)]/14" : "bg-[var(--apple-orange)]/14";
  const fg = isSuccess ? "text-[var(--apple-green-dark)]" : "text-[var(--apple-orange-dark)]";

  return (
    <div
      className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${bg}`}
      aria-hidden
    >
      {isSuccess ? (
        <svg className={`h-6 w-6 ${fg}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className={`h-6 w-6 ${fg}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      )}
    </div>
  );
}

export function AppleDialogHeader({
  title,
  message,
  variant = "default",
  titleId,
  messageId,
  centered = true,
}: {
  title: string;
  message: string;
  variant?: AppleDialogVariant;
  titleId: string;
  messageId: string;
  centered?: boolean;
}) {
  const align = centered ? "text-center" : "text-center sm:text-left";
  return (
    <div className={`px-5 pb-4 pt-5 sm:px-6 sm:pt-6 ${align}`}>
      <DialogIcon variant={variant} />
      <h2
        id={titleId}
        className="text-[1.0625rem] font-semibold leading-snug tracking-tight text-[var(--foreground)]"
      >
        {title}
      </h2>
      <p
        id={messageId}
        className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]"
      >
        {message}
      </p>
    </div>
  );
}
