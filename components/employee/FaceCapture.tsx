"use client";

import {
  buildCameraConstraintAttempts,
  classifyCameraAccessError,
  getFaceDeviceProfile,
  hasCameraApi,
  isSecureForCamera,
  probeVideoInputDevice,
  type CameraAccessFailureKind,
  type FaceProfileKind,
} from "@/lib/faceDeviceProfile";
import { averageFaceDescriptors } from "@/lib/faceMatch";
import {
  descriptorToArray,
  detectFaceInFrame,
  extractFaceDescriptor,
  extractFaceDetection,
  loadFaceModels,
  type FaceExtractOptions,
} from "@/lib/faceRecognitionClient";
import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "enroll" | "verify";

type Props = {
  mode: Mode;
  disabled?: boolean;
  /** verify 모드: 얼굴이 인식되면 버튼 없이 자동으로 onVerified 호출 */
  autoVerify?: boolean;
  /** verify 모드: 세션 API(/api/employee/face) 없이 descriptor만 onVerified에 전달 (로그인 등) */
  verifyOnClientOnly?: boolean;
  /** 로그인 등 — 더 자주·빠르게 스캔 */
  fastScan?: boolean;
  /** true: 얼굴이 프레임에 보일 때만 descriptor 추출·자동 인증 (출입문 단말) */
  scanWhenFaceVisible?: boolean;
  /** scanWhenFaceVisible — 얼굴이 없을 때 표시 문구 */
  scanIdleLabel?: string;
  /** scanWhenFaceVisible — 얼굴이 프레임에서 사라졌을 때 */
  onFaceAbsent?: () => void;
  verifyTitle?: string;
  verifyLead?: string;
  verifyButton?: string;
  /** 카메라 영역 추가 클래스 (출입문 단말 등) */
  videoClassName?: string;
  /** 루트 카드 추가 클래스 */
  rootClassName?: string;
  /** kiosk: 출입문 단말 — 고해상도 카메라·정밀 감지 */
  profileKind?: FaceProfileKind;
  /** 연속 프레임 평균으로 인식 안정화 (출입문 단말) */
  highAccuracyScan?: boolean;
  onEnrolled?: () => void;
  onVerified?: (descriptor: number[]) => boolean | void | Promise<boolean | void>;
  onError?: (message: string) => void;
};

type InitPhase = "idle" | "loading" | "warming" | "ready" | "error";

/** rVFC 사용 시 N 프레임마다 1회 감지 (과부하 방지) */
const SCAN_EVERY_N_FRAMES = 2;
const SCAN_EVERY_N_FRAMES_FAST = 1;
const AUTO_SCAN_INTERVAL_MS = 650;
const AUTO_SCAN_INTERVAL_MS_FAST = 420;
const AUTO_SCAN_INTERVAL_MS_IDLE = 1200;
const AUTO_SCAN_INITIAL_DELAY_MS = 280;
const HIGH_ACCURACY_FRAME_COUNT = 3;

const KIOSK_EXTRACT_OPTIONS: FaceExtractOptions = {
  profileKind: "kiosk",
  minDetectionScore: 0.5,
  minFaceAreaRatio: 0.06,
};

async function openCamera(profileKind: FaceProfileKind = "default"): Promise<MediaStream> {
  const profile = getFaceDeviceProfile(profileKind);
  const attempts = buildCameraConstraintAttempts(profile, profileKind);
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
  verifyOnClientOnly = false,
  fastScan = false,
  scanWhenFaceVisible = false,
  scanIdleLabel,
  onFaceAbsent,
  verifyTitle,
  verifyLead,
  verifyButton,
  videoClassName,
  rootClassName,
  profileKind = "default",
  highAccuracyScan = false,
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
  const verifyBlockedUntilNoFaceRef = useRef(false);
  const faceInFrameRef = useRef(false);
  const qualityBufferRef = useRef<number[][]>([]);
  const profileKindRef = useRef(profileKind);
  profileKindRef.current = profileKind;
  const highAccuracyScanRef = useRef(highAccuracyScan);
  highAccuracyScanRef.current = highAccuracyScan;
  const onFaceAbsentRef = useRef(onFaceAbsent);
  onFaceAbsentRef.current = onFaceAbsent;
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
  const [previewReady, setPreviewReady] = useState(false);
  const [faceInFrame, setFaceInFrame] = useState(false);

  const autoVerifyActive = mode === "verify" && autoVerify;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tx = tRef.current;
    const kind = profileKindRef.current;
    const profile = getFaceDeviceProfile(kind);

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

      const modelsPromise = loadFaceModels();

      try {
        const stream = await openCamera(kind);
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
          if (!cancelled) {
            setPreviewReady(true);
            setPhase("warming");
          }
        }
        setCameraError(null);
        setCameraErrorKind(null);

        await modelsPromise;
        if (cancelled) return;

        if (!cancelled) {
          setReady(true);
          setPhase("ready");
        }
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
  }, [stopCamera, profileKind]);

  useEffect(() => {
    if (previewReady || cameraError) return;
    if (!streamRef.current) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        setPreviewReady(true);
        setPhase((p) => (p === "loading" ? "warming" : p));
        window.clearInterval(id);
        return;
      }
      if (Date.now() - start > 5000) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [previewReady, cameraError]);

  useEffect(() => {
    if (!autoVerifyActive) return;
    if (disabled) return;
    if (!scanStoppedRef.current) return;
    scanStoppedRef.current = false;
    setAutoScanDone(false);
    setStatus(null);
  }, [autoVerifyActive, disabled]);

  const finishClientVerify = useCallback(
    async (arr: number[]): Promise<boolean> => {
      const verified = await onVerifiedRef.current?.(arr);
      if (verified === false) {
        setStatus(tRef.current("employee.faceVerifyRetry"));
        if (scanWhenFaceVisible) {
          verifyBlockedUntilNoFaceRef.current = true;
        }
        return false;
      }
      setStatus(tRef.current("employee.faceVerifyOk"));
      scanStoppedRef.current = true;
      setAutoScanDone(true);
      return true;
    },
    [scanWhenFaceVisible]
  );

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
        const extractOpts =
          profileKindRef.current === "kiosk" ? KIOSK_EXTRACT_OPTIONS : undefined;
        const desc = await extractFaceDescriptor(v, extractOpts);
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

        if (verifyOnClientOnly) {
          return finishClientVerify(arr);
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
    [disabled, mode, ready, verifyOnClientOnly, scanWhenFaceVisible, finishClientVerify]
  );

  useEffect(() => {
    if (!autoVerifyActive || !ready || disabled || cameraError) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frameCounter = 0;
    const scanEvery = fastScan ? SCAN_EVERY_N_FRAMES_FAST : SCAN_EVERY_N_FRAMES;
    const scanInterval = fastScan ? AUTO_SCAN_INTERVAL_MS_FAST : AUTO_SCAN_INTERVAL_MS;

    type VideoWithRvf = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };

    const scheduleInterval = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    async function tryAutoScan() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError || busyRef.current) {
        return;
      }

      const v = videoRef.current;
      if (!v) return;

      if (scanWhenFaceVisible) {
        const kind = profileKindRef.current;
        const hasFace = await detectFaceInFrame(v, { profileKind: kind });
        if (cancelled || scanStoppedRef.current) return;

        const wasInFrame = faceInFrameRef.current;
        faceInFrameRef.current = hasFace;
        setFaceInFrame(hasFace);

        if (!hasFace) {
          if (wasInFrame) {
            onFaceAbsentRef.current?.();
          }
          qualityBufferRef.current = [];
          verifyBlockedUntilNoFaceRef.current = false;
          setStatus(scanIdleLabel ?? tRef.current("employee.faceScanIdle"));
          return;
        }

        if (verifyBlockedUntilNoFaceRef.current) {
          return;
        }

        if (highAccuracyScanRef.current && verifyOnClientOnly) {
          const extracted = await extractFaceDetection(
            v,
            kind === "kiosk" ? KIOSK_EXTRACT_OPTIONS : undefined
          );
          if (cancelled || scanStoppedRef.current) return;

          if (!extracted) {
            qualityBufferRef.current = [];
            setStatus(tRef.current("employee.faceScanning"));
            return;
          }

          qualityBufferRef.current.push(descriptorToArray(extracted.descriptor));
          if (qualityBufferRef.current.length < HIGH_ACCURACY_FRAME_COUNT) {
            setStatus(tRef.current("employee.faceStabilizing"));
            return;
          }

          const averaged = averageFaceDescriptors(qualityBufferRef.current);
          qualityBufferRef.current = [];
          if (!averaged) return;

          busyRef.current = true;
          setBusy(true);
          try {
            await finishClientVerify(averaged);
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
          return;
        }
      }

      await runCapture({ silentNoFace: true });
    }

    async function tick() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError) return;
      await tryAutoScan();
      if (!cancelled && !scanStoppedRef.current) {
        const nextMs =
          scanWhenFaceVisible && !faceInFrameRef.current
            ? AUTO_SCAN_INTERVAL_MS_IDLE
            : scanInterval;
        scheduleInterval(nextMs);
      }
    }

    function onFrame() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError) return;
      frameCounter += 1;
      if (frameCounter % scanEvery === 0 && !busyRef.current) {
        void tryAutoScan();
      }
      const v = videoRef.current as VideoWithRvf | null;
      if (v?.requestVideoFrameCallback && !cancelled && !scanStoppedRef.current) {
        v.requestVideoFrameCallback(onFrame);
      }
    }

    const initial = setTimeout(() => {
      if (cancelled) return;
      const v = videoRef.current as VideoWithRvf | null;
      if (v?.requestVideoFrameCallback && !scanWhenFaceVisible) {
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
  }, [
    autoVerifyActive,
    ready,
    disabled,
    cameraError,
    runCapture,
    fastScan,
    scanWhenFaceVisible,
    scanIdleLabel,
    verifyOnClientOnly,
    finishClientVerify,
  ]);

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
    <div
      className={`overflow-hidden rounded-xl bg-[var(--grouped-bg)] p-3 shadow-sm ring-1 ring-black/[0.04] sm:p-4 ${rootClassName ?? ""}`.trim()}
    >
      <p className="text-sm font-semibold text-[var(--foreground)] sm:text-base">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--apple-label-secondary)] sm:text-sm">{lead}</p>

      {cameraError ? (
        <p className="mt-3 text-sm text-[var(--apple-red)]">{cameraError}</p>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className={`aspect-[4/3] w-full -scale-x-100 cursor-pointer object-cover ${videoClassName ?? ""}`.trim()}
            playsInline
            muted
            autoPlay
            aria-hidden
            onLoadedMetadata={() => {
              setPreviewReady(true);
            }}
            onCanPlay={() => {
              setPreviewReady(true);
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
          {phase === "loading" && !previewReady && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
              {t("employee.faceOpeningCamera")}
            </div>
          )}
          {phase === "warming" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-xs font-medium text-white">
              {t("employee.faceLoadingModels")}
            </div>
          )}
          {autoVerifyActive && ready && !cameraError && !autoScanDone && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded-full bg-black/55 px-3 py-1 text-center text-[0.6875rem] font-medium text-white">
              {busy
                ? t("employee.faceProcessing")
                : scanWhenFaceVisible && !faceInFrame
                  ? (scanIdleLabel ?? t("employee.faceScanIdle"))
                  : t("employee.faceScanning")}
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
