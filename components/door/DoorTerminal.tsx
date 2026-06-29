"use client";

import { AppLogo } from "@/components/AppLogo";
import { FaceCapture } from "@/components/employee/FaceCapture";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/LanguageProvider";
import { formatDoorSwitchTime } from "@/lib/doorTerminalMode";
import { prefetchFaceRecognition } from "@/lib/faceRecognitionClient";
import {
  bannerInfo,
  bannerSuccess,
  btnSecondary,
  card,
  cardBody,
  cardHeader,
  errorText,
  headerActions,
  hint,
  navBar,
  navBarInnerEmployee,
  successText,
} from "@/lib/uiStyles";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

type DoorMode = "CHECK_IN" | "CHECK_OUT";

type ModeInfo = {
  mode: DoorMode;
  workEndTime: string;
  switchAt: string;
  timezone: string;
};

export function DoorTerminal() {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  const [modeInfo, setModeInfo] = useState<ModeInfo | null>(null);
  const [modeError, setModeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureKey, setCaptureKey] = useState(0);
  const punchLockRef = useRef(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadMode = useCallback(async () => {
    try {
      const r = await fetch("/api/door/mode");
      const j = await r.json();
      if (!r.ok) {
        setModeError(true);
        return;
      }
      setModeError(false);
      setModeInfo({
        mode: j.mode === "CHECK_OUT" ? "CHECK_OUT" : "CHECK_IN",
        workEndTime: typeof j.workEndTime === "string" ? j.workEndTime : "18:00",
        switchAt: typeof j.switchAt === "string" ? j.switchAt : "",
        timezone: typeof j.timezone === "string" ? j.timezone : "UTC",
      });
    } catch {
      setModeError(true);
    }
  }, []);

  useEffect(() => {
    prefetchFaceRecognition(true);
    void loadMode();
    const modeTimer = window.setInterval(() => void loadMode(), 60_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(modeTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadMode]);

  const mode: DoorMode = modeInfo?.mode ?? "CHECK_IN";
  const isCheckOut = mode === "CHECK_OUT";

  const mapPunchError = useCallback(
    (code: string | undefined, fallback: string) => {
      if (code === "FACE_NOT_MATCHED" || fallback === "face_not_matched") {
        return t("door.faceNotMatched");
      }
      if (code === "ALREADY_CHECKED_IN" || fallback === "already_checked_in") {
        return t("door.alreadyCheckedIn");
      }
      if (code === "ALREADY_CHECKED_OUT" || fallback === "already_checked_out") {
        return t("door.alreadyCheckedOut");
      }
      if (code === "CHECK_OUT_TOO_EARLY" || fallback === "checkout_too_early") {
        return t("door.checkoutTooEarly");
      }
      if (code === "NOT_CHECKED_IN" || fallback === "not_checked_in") {
        return t("door.notCheckedIn");
      }
      return t("door.punchFail");
    },
    [t]
  );

  const handleVerified = useCallback(
    async (descriptor: number[]) => {
      if (punchLockRef.current || busy) return false;

      punchLockRef.current = true;
      setBusy(true);
      setError(null);
      setMsg(null);

      try {
        const r = await fetch("/api/door/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ faceDescriptor: descriptor }),
        });
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          info?: string;
          error?: string;
          code?: string;
          employee?: { name?: string };
          mode?: DoorMode;
          lastTimestamp?: string | null;
        };

        if (!r.ok) {
          setError(mapPunchError(j.code, j.error ?? ""));
          punchLockRef.current = false;
          return false;
        }

        const name = j.employee?.name ?? "";
        const recordedMode = j.mode ?? mode;
        setMsg(
          recordedMode === "CHECK_OUT"
            ? t("door.checkOutDone").replace("{name}", name)
            : t("door.checkInDone").replace("{name}", name)
        );

        window.setTimeout(() => {
          setMsg(null);
          punchLockRef.current = false;
          setCaptureKey((k) => k + 1);
        }, 3500);

        void loadMode();
        return true;
      } catch {
        setError(t("door.punchFail"));
        punchLockRef.current = false;
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, loadMode, mapPunchError, mode, t]
  );

  const switchLabel =
    modeInfo?.switchAt && modeInfo.timezone
      ? formatDoorSwitchTime(modeInfo.switchAt, modeInfo.timezone, locale)
      : modeInfo?.workEndTime ?? "";

  async function handleSignOut() {
    if (signOutBusy) return;
    setSignOutBusy(true);
    try {
      await signOut({ redirect: false });
    } catch {
      /* 세션 API 실패 시에도 로그인 화면으로 이동 */
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--background)]">
      <header className={`${navBar} shrink-0 pt-[env(safe-area-inset-top,0px)]`}>
        <div className={navBarInnerEmployee}>
          <AppLogo title="HeresNow" />
          <div className={headerActions}>
            <LanguageSwitcher variant="door" />
            <button
              type="button"
              className={btnSecondary}
              disabled={signOutBusy}
              onClick={() => void handleSignOut()}
            >
              {signOutBusy ? t("common.processing") : t("door.signOut")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <section className={`${card} flex min-h-0 flex-1 flex-col`}>
          <div className={cardHeader}>
            <h1 className="text-[1.25rem] font-semibold text-[var(--foreground)] sm:text-[1.5rem] lg:text-[1.75rem]">
              {t("door.title")}
            </h1>
            <p className={`mt-1.5 text-[0.875rem] sm:text-[1rem] ${hint}`}>
              {isCheckOut ? t("door.leadCheckOut") : t("door.leadCheckIn")}
            </p>
          </div>

          <div className={`${cardBody} flex min-h-0 flex-1 flex-col`}>
            <div className={isCheckOut ? bannerInfo : bannerSuccess}>
              <p className="!bg-transparent !p-0 text-[0.9375rem] font-semibold sm:text-[1.0625rem]">
                {isCheckOut ? t("door.modeCheckOut") : t("door.modeCheckIn")}
              </p>
              {!isCheckOut && switchLabel ? (
                <p className="!mt-1 !bg-transparent !p-0 text-[0.8125rem] text-[var(--apple-label-secondary)] sm:text-[0.9375rem]">
                  {t("door.modeCheckOutHint").replace("{time}", switchLabel)}
                </p>
              ) : null}
              {isCheckOut && modeInfo?.workEndTime ? (
                <p className="!mt-1 !bg-transparent !p-0 text-[0.8125rem] text-[var(--apple-label-secondary)] sm:text-[0.9375rem]">
                  {t("door.modeCheckOutUntil").replace("{time}", modeInfo.workEndTime)}
                </p>
              ) : null}
            </div>

            {modeError ? (
              <p className={`${errorText} mt-4 text-center text-[0.9375rem] sm:text-[1rem]`}>
                {t("door.modeLoadFail")}
              </p>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <FaceCapture
                  key={`${mode}-${captureKey}`}
                  mode="verify"
                  autoVerify
                  verifyOnClientOnly
                  scanWhenFaceVisible
                  scanIdleLabel={t("door.faceAwait")}
                  profileKind="kiosk"
                  highAccuracyScan
                  fastScan
                  disabled={busy}
                  rootClassName="flex min-h-0 flex-1 flex-col"
                  videoClassName="mx-auto max-h-[min(58dvh,720px)] w-full"
                  verifyTitle={
                    isCheckOut ? t("door.faceVerifyTitleCheckOut") : t("door.faceVerifyTitleCheckIn")
                  }
                  verifyLead={
                    isCheckOut ? t("door.faceVerifyLeadCheckOut") : t("door.faceVerifyLeadCheckIn")
                  }
                  onVerified={handleVerified}
                  onFaceAbsent={() => {
                    setError(null);
                    setMsg(null);
                  }}
                  onError={(message) => setError(message)}
                />
              </div>
            )}

            {error && (
              <p className={`${errorText} mt-4 text-center text-[0.9375rem] sm:text-[1rem]`}>{error}</p>
            )}
            {msg && (
              <p className={`${successText} mt-4 text-center text-[1.0625rem] font-semibold sm:text-[1.25rem]`}>
                {msg}
              </p>
            )}
          </div>
        </section>

        <p className={`mt-3 shrink-0 pb-[env(safe-area-inset-bottom,0px)] text-center text-[0.8125rem] sm:text-[0.9375rem] ${hint}`}>
          {now.toLocaleString(dateLocale, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </main>
    </div>
  );
}
