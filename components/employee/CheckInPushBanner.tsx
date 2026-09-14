"use client";

import { IosPushInstallGuide } from "@/components/IosPushInstallGuide";
import { useI18n } from "@/components/LanguageProvider";
import { needsIosHomeScreenForPush } from "@/lib/pwaPlatform";
import { bannerInfo, btnPrimary, btnSecondary } from "@/lib/uiStyles";
import { isPushSupported, syncPushSubscriptionToServer } from "@/lib/pushClient";
import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "heresnow_push_banner_dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function CheckInPushBanner() {
  const { t, locale } = useI18n();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isDismissed()) {
      setVisible(false);
      return;
    }
    if (needsIosHomeScreenForPush()) {
      setVisible(true);
      return;
    }
    if (!isPushSupported()) {
      setVisible(false);
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setVisible(false);
      return;
    }
    try {
      const r = await fetch("/api/user/push-subscription");
      const j = (await r.json().catch(() => ({}))) as { configured?: boolean; subscribed?: boolean };
      setVisible(Boolean(j.configured && !j.subscribed));
    } catch {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const result = await syncPushSubscriptionToServer(locale);
      if (!result.ok) {
        if (result.error === "PERMISSION_DENIED") {
          setError(t("account.pushPermissionDenied"));
        } else {
          setError(t("account.pushEnableFail"));
        }
        return;
      }
      setVisible(false);
    } catch {
      setError(t("account.pushEnableFail"));
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  if (needsIosHomeScreenForPush()) {
    return (
      <div className="mb-4 space-y-2">
        <IosPushInstallGuide variant="inline" />
        <div className="flex justify-end">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              dismissBanner();
              setVisible(false);
            }}
          >
            {t("employee.pushBannerDismiss")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bannerInfo} mb-4 space-y-2`}>
      <p className="text-sm">{t("employee.pushBannerLead")}</p>
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void enable()}>
          {busy ? t("account.pushEnabling") : t("employee.pushBannerEnable")}
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={busy}
          onClick={() => {
            dismissBanner();
            setVisible(false);
          }}
        >
          {t("employee.pushBannerDismiss")}
        </button>
      </div>
    </div>
  );
}
