"use client";

import {
  descriptorToArray,
  extractFaceDescriptor,
  loadFaceModels,
} from "@/lib/faceRecognitionClient";
import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "enroll" | "verify";

type Props = {
  mode: Mode;
  disabled?: boolean;
  /** verify 모드: 얼굴이 인식되면 버튼 없이 자동으로 onVerified 호출 */
  autoVerify?: boolean;
  verifyTitle?: string;
  verifyLead?: string;
  verifyButton?: string;
  onEnrolled?: () => void;
  onVerified?: (descriptor: number[]) => boolean | void | Promise<boolean | void>;
  onError?: (message: string) => void;
};

type InitPhase = "idle" | "loading-models" | "starting-camera" | "ready" | "error";

const AUTO_SCAN_INTERVAL_MS = 1_100;
const AUTO_SCAN_INITIAL_DELAY_MS = 500;

export function FaceCapture({
  mode,
  disabled,
  autoVerify = false,
  verifyTitle,
  verifyLead,
  verifyButton,
  onEnrolled,
  onVerified,
  onError,
}: Props) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanStoppedRef = useRef(false);
  const busyRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  const onEnrolledRef = useRef(onEnrolled);
  const onErrorRef = useRef(onError);
  onVerifiedRef.current = onVerified;
  onEnrolledRef.current = onEnrolled;
  onErrorRef.current = onError;

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<InitPhase>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [autoScanDone, setAutoScanDone] = useState(false);

  const autoVerifyActive = mode === "verify" && autoVerify;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tx = tRef.current;

    function isIosInAppBrowser(): boolean {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      const ios =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" &&
          (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !== undefined &&
          ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1);
      if (!ios) return false;
      return (
        /KAKAOTALK|NAVER|Line\//i.test(ua) ||
        /Instagram|FBAN|FBAV|FB_IAB|Snapchat|Twitter|TikTok|wv\)/i.test(ua) ||
        (!/Safari\//.test(ua) && !/CriOS\/|FxiOS\/|EdgiOS\//.test(ua))
      );
    }

    function deriveErrorMessage(err: unknown): string {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        return tx("employee.faceInsecureContext");
      }
      if (isIosInAppBrowser()) {
        return tx("employee.faceInAppBrowser");
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        return tx("employee.faceUnsupportedBrowser");
      }
      if (err instanceof Error) {
        if (err.message.startsWith("FACE_MODELS_FAILED")) {
          return tx("employee.faceModelLoadFail");
        }
        if (err.message === "FACE_BACKEND_UNAVAILABLE") {
          return tx("employee.faceBackendUnavailable");
        }
        switch (err.name) {
          case "NotAllowedError":
          case "SecurityError":
            return tx("employee.faceCameraDenied");
          case "NotFoundError":
          case "OverconstrainedError":
            return tx("employee.faceNoCamera");
          case "NotReadableError":
          case "AbortError":
            return tx("employee.faceCameraInUse");
          case "TypeError":
            return tx("employee.faceUnsupportedBrowser");
        }
      }
      return tx("employee.faceCameraDenied");
    }

    async function init() {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        if (!cancelled) {
          setCameraError(tx("employee.faceInsecureContext"));
          setPhase("error");
        }
        return;
      }
      if (isIosInAppBrowser()) {
        if (!cancelled) {
          setCameraError(tx("employee.faceInAppBrowser"));
          setPhase("error");
        }
        return;
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        if (!cancelled) {
          setCameraError(tx("employee.faceUnsupportedBrowser"));
          setPhase("error");
        }
        return;
      }

      try {
        if (!cancelled) setPhase("loading-models");
        await loadFaceModels();
        if (cancelled) return;
        if (!cancelled) setPhase("starting-camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().then(
            () => {
              if (!cancelled) setNeedsTap(false);
            },
            (e) => {
              console.warn("[face] video.play() rejected (will retry on user gesture)", e);
              if (!cancelled) setNeedsTap(true);
            }
          );
          if (video.readyState >= 1) {
            setReady(true);
            if (!cancelled) setPhase("ready");
          }
        }
        setCameraError(null);
      } catch (err) {
        console.error("[face] init failed", err);
        if (!cancelled) {
          setCameraError(deriveErrorMessage(err));
          setPhase("error");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (ready || cameraError) return;
    if (!streamRef.current) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        setReady(true);
        setPhase("ready");
        window.clearInterval(id);
        return;
      }
      if (Date.now() - start > 5000) {
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [ready, cameraError]);

  /** 출퇴근 API 실패 후 다시 자동 인식 재개 */
  useEffect(() => {
    if (!autoVerifyActive) return;
    if (disabled) return;
    if (!scanStoppedRef.current) return;
    scanStoppedRef.current = false;
    setAutoScanDone(false);
    setStatus(null);
  }, [autoVerifyActive, disabled]);

  const runCapture = useCallback(
    async (opts?: { silentNoFace?: boolean }) => {
      if (!videoRef.current || !ready || busyRef.current || disabled) return false;
      busyRef.current = true;
      setBusy(true);
      if (!opts?.silentNoFace) setStatus(null);

      try {
        const v = videoRef.current;
        if (v.paused) {
          try {
            await v.play();
            setNeedsTap(false);
          } catch (e) {
            console.warn("[face] play() on capture failed", e);
          }
        }
        const desc = await extractFaceDescriptor(v);
        if (!desc) {
          if (!opts?.silentNoFace) {
            const msg = tRef.current("employee.faceNotDetected");
            setStatus(msg);
            onErrorRef.current?.(msg);
          } else {
            setStatus(tRef.current("employee.faceScanning"));
          }
          return false;
        }
        const arr = descriptorToArray(desc);

        if (mode === "enroll") {
          const r = await fetch("/api/employee/face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descriptor: arr }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msg =
              typeof j.error === "string" ? j.error : tRef.current("employee.faceEnrollFail");
            setStatus(msg);
            onErrorRef.current?.(msg);
            return false;
          }
          setStatus(tRef.current("employee.faceEnrollOk"));
          scanStoppedRef.current = true;
          onEnrolledRef.current?.();
          return true;
        }

        const r = await fetch("/api/employee/face", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptor: arr }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg =
            typeof j.error === "string" ? j.error : tRef.current("employee.faceVerifyFail");
          setStatus(msg);
          onErrorRef.current?.(msg);
          return false;
        }
        setStatus(tRef.current("employee.faceVerifyOk"));
        const punchOk = await onVerifiedRef.current?.(arr);
        if (punchOk === false) {
          setStatus(tRef.current("employee.faceVerifyRetry"));
          return false;
        }
        scanStoppedRef.current = true;
        setAutoScanDone(true);
        return true;
      } catch {
        const msg = tRef.current("employee.faceProcessFail");
        setStatus(msg);
        onErrorRef.current?.(msg);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [disabled, mode, ready]
  );

  useEffect(() => {
    if (!autoVerifyActive || !ready || disabled || cameraError) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (ms: number) => {
      timer = setTimeout(() => void tick(), ms);
    };

    async function tick() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError) return;
      await runCapture({ silentNoFace: true });
      if (!cancelled && !scanStoppedRef.current) {
        schedule(AUTO_SCAN_INTERVAL_MS);
      }
    }

    schedule(AUTO_SCAN_INITIAL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [autoVerifyActive, ready, disabled, cameraError, runCapture]);

  const title =
    mode === "enroll"
      ? t("employee.faceEnrollTitle")
      : (verifyTitle ?? t("employee.faceVerifyTitle"));
  const lead =
    mode === "enroll" ? t("employee.faceEnrollLead") : (verifyLead ?? t("employee.faceVerifyLead"));
  const buttonLabel =
    mode === "enroll"
      ? t("employee.faceEnrollButton")
      : (verifyButton ?? t("employee.faceVerifyButton"));
  const showManualButton = !autoVerifyActive || mode === "enroll";

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--grouped-bg)] p-3 shadow-sm ring-1 ring-black/[0.04] sm:p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--apple-label-secondary)]">{lead}</p>

      {cameraError ? (
        <p className="mt-3 text-sm text-[var(--apple-red)]">{cameraError}</p>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full -scale-x-100 cursor-pointer object-cover"
            playsInline
            muted
            autoPlay
            aria-hidden
            onLoadedMetadata={() => {
              setReady(true);
              setPhase("ready");
            }}
            onCanPlay={() => {
              setReady(true);
              setPhase("ready");
            }}
            onClick={() => {
              const v = videoRef.current;
              if (v && v.paused) {
                v.play()
                  .then(() => setNeedsTap(false))
                  .catch((e) => console.warn("[face] tap play failed", e));
              }
            }}
          />
          <div
            className="pointer-events-none absolute inset-8 rounded-[50%] border-2 border-dashed border-white/70"
            aria-hidden
          />
          {(phase === "loading-models" || phase === "starting-camera") && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
              {phase === "loading-models"
                ? t("employee.faceLoadingModels")
                : t("employee.faceStartingCamera")}
            </div>
          )}
          {autoVerifyActive && ready && !cameraError && !autoScanDone && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded-full bg-black/55 px-3 py-1 text-center text-[0.6875rem] font-medium text-white">
              {busy ? t("employee.faceProcessing") : t("employee.faceScanning")}
            </div>
          )}
          {needsTap && phase !== "loading-models" && phase !== "starting-camera" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded-full bg-white/85 px-3 py-1 text-center text-[0.6875rem] font-semibold text-[var(--foreground)]">
              {t("employee.faceTapToStart")}
            </div>
          )}
        </div>
      )}

      {showManualButton && (
        <button
          type="button"
          disabled={!ready || busy || disabled || !!cameraError}
          onClick={() => void runCapture()}
          className="mt-3 flex min-h-[3rem] w-full touch-manipulation items-center justify-center rounded-xl bg-[var(--apple-blue)] py-3 text-base font-semibold text-white hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-50"
        >
          {busy ? t("employee.faceProcessing") : buttonLabel}
        </button>
      )}
      {status && <p className="mt-2 text-center text-sm text-[var(--apple-label-secondary)]">{status}</p>}
    </div>
  );
}
