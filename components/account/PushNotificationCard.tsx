"use client";

import { IosPushInstallGuide } from "@/components/IosPushInstallGuide";
import { useI18n } from "@/components/LanguageProvider";
import { needsIosHomeScreenForPush } from "@/lib/pwaPlatform";
import {
  bannerInfo,
  bannerSuccess,
  btnPrimary,
  btnSecondary,
  card,
  cardBody,
  cardHeader,
  errorText,
  hint,
} from "@/lib/uiStyles";
import {
  isPushSupported,
  removePushSubscriptionFromServer,
  syncPushSubscriptionToServer,
} from "@/lib/pushClient";
import { useCallback, useEffect, useMemo, useState } from "react";

type PushStatus = {
  configured: boolean;
  subscribed: boolean;
  subscriptionCount: number;
};

export function PushNotificationCard() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const supported = useMemo(() => isPushSupported(), []);
  const iosNeedsHomeScreen = useMemo(() => needsIosHomeScreenForPush(), []);
  const permission =
    typeof Notification !== "undefined" ? Notification.permission : "default";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/user/push-subscription");
      const j = (await r.json().catch(() => ({}))) as Partial<PushStatus>;
      if (!r.ok) {
        setError(t("account.pushLoadFail"));
        setStatus(null);
      } else {
        setStatus({
          configured: Boolean(j.configured),
          subscribed: Boolean(j.subscribed),
          subscriptionCount: Number(j.subscriptionCount ?? 0),
        });
      }
    } catch {
      setError(t("account.pushLoadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enablePush() {
    if (!supported) {
      setError(t("account.pushNotSupported"));
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await syncPushSubscriptionToServer(locale);
      if (!result.ok) {
        if (result.error === "PERMISSION_DENIED") {
          setError(t("account.pushPermissionDenied"));
        } else if (result.error === "NOT_CONFIGURED") {
          setError(t("account.pushNotConfigured"));
        } else {
          setError(t("account.pushEnableFail"));
        }
        return;
      }
      setSuccess(t("account.pushEnabled"));
      await load();
    } catch {
      setError(t("account.pushEnableFail"));
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!window.confirm(t("account.pushDisableConfirm"))) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const ok = await removePushSubscriptionFromServer();
      if (!ok) {
        setError(t("account.pushDisableFail"));
        return;
      }
      setSuccess(t("account.pushDisabled"));
      await load();
    } catch {
      setError(t("account.pushDisableFail"));
    } finally {
      setBusy(false);
    }
  }

  if (!supported && !iosNeedsHomeScreen) {
    return (
      <section className={card}>
        <div className={cardHeader}>
          <h2 className="text-base font-semibold text-[var(--foreground)]">{t("account.pushTitle")}</h2>
        </div>
        <div className={cardBody}>
          <p className={hint}>{t("account.pushNotSupported")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={card}>
      <div className={cardHeader}>
        <h2 className="text-base font-semibold text-[var(--foreground)]">{t("account.pushTitle")}</h2>
        <p className="mt-1 text-sm text-[var(--apple-label-secondary)]">{t("account.pushLead")}</p>
      </div>
      <div className={`${cardBody} space-y-3`}>
        {loading ? (
          <p className={hint}>{t("account.pushLoading")}</p>
        ) : (
          <>
            <IosPushInstallGuide />
            {status && !status.configured ? (
              <div className={bannerInfo}>{t("account.pushNotConfigured")}</div>
            ) : null}
            {iosNeedsHomeScreen ? (
              <p className={hint}>{t("account.pushIosEnableBlocked")}</p>
            ) : (
            <p className={hint}>
              {status?.subscribed
                ? t("account.pushStatusOn")
                : permission === "denied"
                  ? t("account.pushPermissionDenied")
                  : t("account.pushStatusOff")}
            </p>
            )}
            {error ? <p className={errorText}>{error}</p> : null}
            {success ? <div className={bannerSuccess}>{success}</div> : null}
            <div className="flex flex-wrap gap-2">
              {!status?.subscribed ? (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || !status?.configured || iosNeedsHomeScreen}
                  onClick={() => void enablePush()}
                >
                  {busy ? t("account.pushEnabling") : t("account.pushEnable")}
                </button>
              ) : (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => void disablePush()}
                >
                  {busy ? t("account.pushDisabling") : t("account.pushDisable")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
