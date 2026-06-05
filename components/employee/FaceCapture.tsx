"use client";

import {
  buildCameraConstraintAttempts,
  classifyCameraAccessError,
  getFaceDeviceProfile,
  hasCameraApi,
  isSecureForCamera,
  probeVideoInputDevice,
  type CameraAccessFailureKind,
} from "@/lib/faceDeviceProfile";
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

type InitPhase = "idle" | "loading" | "ready" | "error";

/** 폴백 스캔 간격 (requestVideoFrameCallback 미지원 기기) */
const AUTO_SCAN_INTERVAL_MS = 650;
const AUTO_SCAN_INITIAL_DELAY_MS = 280;
/** rVFC 사용 시 N 프레임마다 1회 감지 (과부하 방지) */
const SCAN_EVERY_N_FRAMES = 2;

async function openCamera(): Promise<MediaStream> {
  const attempts = buildCameraConstraintAttempts(getFaceDeviceProfile());
  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("CAMERA_UNAVAILABLE");
}

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
  const [cameraErrorKind, setCameraErrorKind] = useState<CameraAccessFailureKind | null>(
    null
  );
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
    const profile = getFaceDeviceProfile();

    function failCamera(kind: CameraAccessFailureKind, message: string) {
      if (cancelled) return;
      setCameraErrorKind(kind);
      setCameraError(message);
      setPhase("error");
    }

    async function init() {
      if (!isSecureForCamera()) {
        failCamera("other", tx("employee.faceInsecureContext"));
        return;
      }
      if (!hasCameraApi()) {
        failCamera("other", tx("employee.faceUnsupportedBrowser"));
        return;
      }

      const videoProbe = await probeVideoInputDevice();
      if (videoProbe === "no") {
        failCamera("no_camera", tx("employee.faceNoCamera"));
        return;
      }

      if (!cancelled) setPhase("loading");

      try {
        const [, stream] = await Promise.all([loadFaceModels(), openCamera()]);
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.muted = true;
          video.play().then(
            () => {
              if (!cancelled) setNeedsTap(false);
            },
            () => {
              if (!cancelled) setNeedsTap(true);
            }
          );
          if (video.readyState >= 1) {
            setReady(true);
            if (!cancelled) setPhase("ready");
          }
        }
        setCameraError(null);
        setCameraErrorKind(null);
      } catch (err) {
        const classified = classifyCameraAccessError(err, profile);
        if (classified.kind !== "no_camera") {
          console.warn("[face] init failed", err);
        }
        if (!cancelled) {
          failCamera(classified.kind, tx(classified.messageKey));
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
    }, 200);
    return () => window.clearInterval(id);
  }, [ready, cameraError]);

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
          } catch {
            /* user gesture may be required */
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frameCounter = 0;

    type VideoWithRvf = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };

    const scheduleInterval = () => {
      timer = setTimeout(() => void tick(), AUTO_SCAN_INTERVAL_MS);
    };

    async function tick() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError) return;
      await runCapture({ silentNoFace: true });
      if (!cancelled && !scanStoppedRef.current) {
        scheduleInterval();
      }
    }

    function onFrame() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError) return;
      frameCounter += 1;
      if (frameCounter % SCAN_EVERY_N_FRAMES === 0 && !busyRef.current) {
        void runCapture({ silentNoFace: true });
      }
      const v = videoRef.current as VideoWithRvf | null;
      if (v?.requestVideoFrameCallback && !cancelled && !scanStoppedRef.current) {
        v.requestVideoFrameCallback(onFrame);
      }
    }

    const initial = setTimeout(() => {
      if (cancelled) return;
      const v = videoRef.current as VideoWithRvf | null;
      if (v?.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(onFrame);
      } else {
        void tick();
      }
    }, AUTO_SCAN_INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (timer) clearTimeout(timer);
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
  const showManualButton = mode === "enroll" || !autoVerify;

  if (cameraErrorKind === "no_camera" && cameraError) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border-2 border-[var(--apple-red)] bg-[color-mix(in_srgb,var(--apple-red)_12%,var(--grouped-bg))] px-4 py-6 text-center shadow-sm">
        <p className="text-sm font-medium leading-relaxed text-[var(--apple-red)]">{cameraError}</p>
      </div>
    );
  }

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
                  .catch(() => {
                    /* 사용자 탭 재생 실패 — 무시 */
                  });
              }
            }}
          />
          <div
            className="pointer-events-none absolute inset-8 rounded-[50%] border-2 border-dashed border-white/70"
            aria-hidden
          />
          {phase === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
              {t("employee.faceLoadingModels")}
            </div>
          )}
          {autoVerifyActive && ready && !cameraError && !autoScanDone && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded-full bg-black/55 px-3 py-1 text-center text-[0.6875rem] font-medium text-white">
              {busy ? t("employee.faceProcessing") : t("employee.faceScanning")}
            </div>
          )}
          {needsTap && phase !== "loading" && (
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
