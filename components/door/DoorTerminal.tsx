"use client";

import { AppLogo } from "@/components/AppLogo";
import { DoorEarlyCheckInDialog } from "@/components/door/DoorEarlyCheckInDialog";
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
  const [earlyDialog, setEarlyDialog] = useState<{
    employeeId: string;
    employeeName: string;
    nextCheckInAt: string | null;
    alreadyRequested: boolean;
  } | null>(null);

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
      if (code === "CHECK_IN_TOO_EARLY" || fallback === "checkin_too_early") {
        // 팝업으로 안내 — 인라인 에러 문구는 사용하지 않음
        return "";
      }
      if (code === "CHECK_IN_COOLDOWN" || fallback === "checkin_cooldown") {
        return t("door.checkInCooldown");
      }
      if (code === "CHECK_OUT_COOLDOWN" || fallback === "checkout_cooldown") {
        return t("door.checkOutCooldown");
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
        // 안면 로그인과 동일: 평균 단일 descriptor.
        // (다중 프레임+다양성 요구는 가만히 서면 서버 거절, 움직이면 클라이언트 고착)
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
          employee?: { id?: string; name?: string };
          mode?: DoorMode;
          lastTimestamp?: string | null;
          nextCheckInAt?: string | null;
          earlyRequestStatus?: "PENDING" | "APPROVED" | null;
        };

        if (!r.ok) {
          if (
            (j.code === "CHECK_IN_TOO_EARLY" || j.error === "checkin_too_early") &&
            typeof j.employee?.id === "string"
          ) {
            setError(null);
            setEarlyDialog({
              employeeId: j.employee.id,
              employeeName: j.employee.name ?? "",
              nextCheckInAt:
                typeof j.nextCheckInAt === "string" ? j.nextCheckInAt : null,
              alreadyRequested: j.earlyRequestStatus === "PENDING",
            });
            punchLockRef.current = false;
            return false;
          }
          const mapped = mapPunchError(j.code, j.error ?? "");
          if (mapped) setError(mapped);
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
      await signOut({ callbackUrl: "/login" });
    } catch {
      window.location.assign("/login");
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--background)]">
      <header className={`${navBar} shrink-0 pt-[env(safe-area-inset-top,0px)]`}>
        <div className={navBarInnerEmployee}>
          <AppLogo title={t("login.title")} />
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
                  intent="punch"
                  fastScan
                  highAccuracyScan
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

      <DoorEarlyCheckInDialog
        open={earlyDialog != null}
        employeeId={earlyDialog?.employeeId ?? ""}
        employeeName={earlyDialog?.employeeName ?? ""}
        nextCheckInAt={earlyDialog?.nextCheckInAt ?? null}
        alreadyRequested={earlyDialog?.alreadyRequested ?? false}
        onClose={() => {
          setEarlyDialog(null);
          punchLockRef.current = false;
          setCaptureKey((k) => k + 1);
        }}
        onSubmitted={() => {
          setEarlyDialog(null);
          setMsg(t("door.earlyCheckInRequestDone"));
          punchLockRef.current = false;
          window.setTimeout(() => {
            setMsg(null);
            setCaptureKey((k) => k + 1);
          }, 3500);
        }}
      />
    </div>
  );
}
