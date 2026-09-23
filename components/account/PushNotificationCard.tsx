"use client";

import { IosPushInstallGuide } from "@/components/IosPushInstallGuide";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useI18n } from "@/components/LanguageProvider";
import { needsIosHomeScreenForPush } from "@/lib/pwaPlatform";
import {
  bannerInfo,
  bannerSuccess,
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
import { useCallback, useEffect, useState } from "react";

type PushStatus = {
  configured: boolean;
  subscribed: boolean;
  subscriptionCount: number;
  dbReady: boolean;
};

const DEFAULT_STATUS: PushStatus = {
  configured: false,
  subscribed: false,
  subscriptionCount: 0,
  dbReady: true,
};

type Props = {
  className?: string;
};

export function PushNotificationCard({ className = "" }: Props) {
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [iosNeedsHomeScreen, setIosNeedsHomeScreen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [status, setStatus] = useState<PushStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setSupported(isPushSupported());
    setIosNeedsHomeScreen(needsIosHomeScreenForPush());
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/user/push-subscription");
      const j = (await r.json().catch(() => ({}))) as Partial<PushStatus & { error?: string }>;
      if (!r.ok) {
        setStatus({
          configured: Boolean(j.configured),
          subscribed: false,
          subscriptionCount: 0,
          dbReady: j.dbReady !== false,
        });
        if (j.error === "DB_NOT_READY") {
          setError(t("account.pushDbNotReady"));
        } else {
          setError(t("account.pushLoadFail"));
        }
        return;
      }
      setStatus({
        configured: Boolean(j.configured),
        subscribed: Boolean(j.subscribed),
        subscriptionCount: Number(j.subscriptionCount ?? 0),
        dbReady: j.dbReady !== false,
      });
    } catch {
      setStatus(DEFAULT_STATUS);
      setError(t("account.pushLoadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [mounted, load]);

  async function sendTestPush() {
    if (testBusy || busy) return;
    if (!status.configured) {
      setError(t("account.pushNotConfigured"));
      return;
    }
    if (!status.subscribed) {
      setError(t("account.pushTestNoSubscription"));
      return;
    }

    setTestBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/user/push-subscription/test", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sent?: number };
      if (!r.ok) {
        if (j.error === "NOT_CONFIGURED") setError(t("account.pushNotConfigured"));
        else if (j.error === "NO_SUBSCRIPTION") setError(t("account.pushTestNoSubscription"));
        else setError(t("account.pushTestFail"));
        await load();
        return;
      }
      setSuccess(t("account.pushTestOk"));
    } catch {
      setError(t("account.pushTestFail"));
    } finally {
      setTestBusy(false);
    }
  }

  async function setPushEnabled(next: boolean) {
    if (busy) return;
    if (next) {
      if (!supported) {
        setError(t("account.pushNotSupported"));
        return;
      }
      if (iosNeedsHomeScreen) {
        setError(t("account.pushIosEnableBlocked"));
        return;
      }
      if (!status.configured) {
        setError(t("account.pushNotConfigured"));
        return;
      }
      if (permission === "denied") {
        setError(t("account.pushPermissionDenied"));
        return;
      }
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    const prevSubscribed = status.subscribed;
    setStatus((s) => ({ ...s, subscribed: next }));

    try {
      if (next) {
        const result = await syncPushSubscriptionToServer(locale);
        if (!result.ok) {
          setStatus((s) => ({ ...s, subscribed: prevSubscribed }));
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
      } else {
        const ok = await removePushSubscriptionFromServer();
        if (!ok) {
          setStatus((s) => ({ ...s, subscribed: prevSubscribed }));
          setError(t("account.pushDisableFail"));
          return;
        }
        setSuccess(t("account.pushDisabled"));
      }
      await load();
    } catch {
      setStatus((s) => ({ ...s, subscribed: prevSubscribed }));
      setError(next ? t("account.pushEnableFail") : t("account.pushDisableFail"));
    } finally {
      setBusy(false);
    }
  }

  const statusHint = !mounted || loading
    ? t("account.pushLoading")
    : iosNeedsHomeScreen
      ? t("account.pushIosEnableBlocked")
      : !status.dbReady
        ? t("account.pushDbNotReady")
        : !status.configured
          ? t("account.pushNotConfigured")
          : status.subscribed
            ? t("account.pushStatusOn")
            : permission === "denied"
              ? t("account.pushPermissionDenied")
              : t("account.pushStatusOff");

  const toggleDisabled =
    !mounted ||
    loading ||
    busy ||
    iosNeedsHomeScreen ||
    !status.configured ||
    !status.dbReady ||
    permission === "denied";

  const showUnsupported = mounted && !supported && !iosNeedsHomeScreen;

  return (
    <section className={`${card} ${className}`.trim()}>
      <div className={cardHeader}>
        <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{t("account.pushTitle")}</p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">{t("account.pushLead")}</p>
      </div>
      <div className={`${cardBody} flex flex-1 flex-col space-y-3`}>
        {showUnsupported ? (
          <p className={hint}>{t("account.pushNotSupported")}</p>
        ) : (
          <>
            <IosPushInstallGuide />

            <div className="flex items-start justify-between gap-4 rounded-xl bg-[var(--fill-tertiary)] px-4 py-3.5 sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
                  {t("account.pushToggleLabel")}
                </p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--apple-label-secondary)]">
                  {statusHint}
                </p>
              </div>
              <ToggleSwitch
                checked={status.subscribed}
                disabled={toggleDisabled || showUnsupported}
                ariaLabel={t("account.pushToggleLabel")}
                onChange={(next) => void setPushEnabled(next)}
              />
            </div>

            {error ? <p className={errorText}>{error}</p> : null}
            {success ? <div className={bannerSuccess}>{success}</div> : null}
            {mounted && !loading && status.configured && !iosNeedsHomeScreen && permission !== "denied" ? (
              <div className={bannerInfo}>{t("account.pushToggleHint")}</div>
            ) : null}

            {mounted &&
            !loading &&
            status.configured &&
            !iosNeedsHomeScreen &&
            permission !== "denied" ? (
              <button
                type="button"
                className={`${btnSecondary} w-full sm:w-auto`}
                disabled={testBusy || busy || !status.subscribed}
                onClick={() => void sendTestPush()}
              >
                {testBusy ? t("account.pushTestSending") : t("account.pushTestButton")}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
