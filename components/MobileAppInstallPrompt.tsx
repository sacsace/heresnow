"use client";

import { useI18n } from "@/components/LanguageProvider";
import { AppLogo } from "@/components/AppLogo";
import { btnPrimary, btnSecondary } from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "heresnow_install_prompt_dismissed";
const DISMISS_DAYS = 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isProductionMobileHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "heresnow.in" || h === "www.heresnow.in") return true;
  if (process.env.NODE_ENV === "development" && (h === "localhost" || h === "127.0.0.1")) {
    return true;
  }
  return false;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return navigator.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return navigator.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismissPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function MobileAppInstallPrompt() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isProductionMobileHost() || !isMobileDevice() || isStandaloneApp() || isDismissedRecently()) {
      return;
    }
    setPlatform(isIos() ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "other");
    setOpen(true);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleDismiss = useCallback(() => {
    dismissPrompt();
    setOpen(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      /* ignore */
    } finally {
      setInstalling(false);
      setInstallEvent(null);
      setOpen(false);
    }
  }, [installEvent]);

  if (!open) return null;

  const steps =
    platform === "ios"
      ? t("install.iosSteps")
      : platform === "android"
        ? installEvent
          ? t("install.androidInstallReady")
          : t("install.androidSteps")
        : t("install.genericSteps");

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-prompt-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--background)] shadow-xl ring-1 ring-black/10">
        <div className="border-b border-[var(--separator)] px-5 py-4">
          <div className="flex items-center gap-3">
            <AppLogo title="" />
            <div className="min-w-0">
              <h2
                id="install-prompt-title"
                className="text-[1.0625rem] font-semibold text-[var(--foreground)]"
              >
                {t("install.title")}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--apple-label-secondary)]">
                {t("install.lead")}
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="whitespace-pre-line text-[0.875rem] leading-relaxed text-[var(--foreground)]">
            {steps}
          </p>
          {platform === "ios" && (
            <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--apple-label-secondary)]">
              {t("install.iosCameraNote")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--separator)] px-5 py-4 sm:flex-row sm:justify-end">
          {platform === "android" && installEvent && (
            <button
              type="button"
              className={`${btnPrimary} w-full sm:order-2 sm:w-auto`}
              disabled={installing}
              onClick={() => void handleInstall()}
            >
              {installing ? t("common.processing") : t("install.installButton")}
            </button>
          )}
          <button
            type="button"
            className={`${btnSecondary} w-full sm:order-1 sm:w-auto`}
            onClick={handleDismiss}
          >
            {t("install.laterButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
