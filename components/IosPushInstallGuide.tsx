"use client";

import { useI18n } from "@/components/LanguageProvider";
import { isInAppBrowser, needsIosHomeScreenForPush } from "@/lib/pwaPlatform";
import { bannerInfo } from "@/lib/uiStyles";

type Props = {
  /** card: 계정 설정, inline: 출퇴근 배너 */
  variant?: "card" | "inline";
  className?: string;
};

export function IosPushInstallGuide({ variant = "card", className = "" }: Props) {
  const { t } = useI18n();

  if (!needsIosHomeScreenForPush()) return null;

  const steps = [
    t("account.pushIosStep1"),
    t("account.pushIosStep2"),
    t("account.pushIosStep3"),
    t("account.pushIosStep4"),
  ];

  const wrapClass =
    variant === "inline"
      ? `${bannerInfo} space-y-2 ${className}`.trim()
      : `rounded-xl border border-[var(--separator)] bg-[var(--apple-blue)]/5 px-4 py-3 space-y-2 ${className}`.trim();

  return (
    <div className={wrapClass} role="note" aria-label={t("account.pushIosGuideTitle")}>
      <p className="text-sm font-semibold text-[var(--foreground)]">{t("account.pushIosGuideTitle")}</p>
      <p className="text-sm leading-relaxed text-[var(--apple-label-secondary)]">
        {t("account.pushIosGuideLead")}
      </p>
      <ol className="list-none space-y-2 pt-1">
        {steps.map((step, index) => (
          <li
            key={index}
            className="flex gap-2 text-sm leading-relaxed text-[var(--foreground)]"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--apple-blue)] text-[0.6875rem] font-bold text-white"
              aria-hidden
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-[0.75rem] leading-relaxed text-[var(--apple-label-secondary)]">
        {t("account.pushIosVersionNote")}
      </p>
      {isInAppBrowser() ? (
        <p className="text-[0.75rem] leading-relaxed text-[var(--apple-label-secondary)]">
          {t("install.iosCameraNote")}
        </p>
      ) : null}
    </div>
  );
}
