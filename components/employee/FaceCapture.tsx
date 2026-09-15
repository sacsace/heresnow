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
import { captureVideoFrameAsJpegDataUrl } from "@/lib/facePreviewCapture";
import {
  averageFaceDescriptors,
  computeCaptureQualityPercent,
  descriptorSpread,
} from "@/lib/faceMatch";
import {
  descriptorToArray,
  extractFaceDescriptor,
  extractFaceDetection,
  loadFaceModels,
  LOGIN_FACE_EXTRACT_OPTIONS,
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
  /** false: 실패 후에도 얼굴을 프레임에 유지한 채 재시도 (로그인) */
  blockRetryUntilFaceAbsent?: boolean;
  verifyRetryLabel?: string;
  /** login 등록 — 정면·좌·우 다각도 자동 캡처 + 인식률 % 표시 */
  multiAngleEnroll?: boolean;
  /** 추가 등록 시 기존 안면과 일치율 표시 */
  enrollCompareExisting?: boolean;
  enrollTitle?: string;
  enrollLead?: string;
  onEnrolled?: () => void;
  onVerified?: (
    descriptor: number[],
    context?: { frameDescriptors?: number[][] }
  ) => boolean | void | Promise<boolean | void>;
  onError?: (message: string) => void;
};

type InitPhase = "idle" | "loading" | "warming" | "ready" | "error";

/** rVFC 사용 시 N 프레임마다 1회 감지 (과부하 방지) */
const SCAN_EVERY_N_FRAMES = 2;
const SCAN_EVERY_N_FRAMES_FAST = 1;
const AUTO_SCAN_INTERVAL_MS = 650;
const AUTO_SCAN_INTERVAL_MS_FAST = 160;
const AUTO_SCAN_INTERVAL_MS_IDLE = 500;
const AUTO_SCAN_INITIAL_DELAY_MS = 120;
const AUTO_SCAN_INITIAL_DELAY_MS_FAST = 50;
const HIGH_ACCURACY_FRAME_COUNT = 2;
const HIGH_ACCURACY_FRAME_COUNT_LOGIN = 5;
const HIGH_ACCURACY_FRAME_COUNT_KIOSK = 5;
const HIGH_ACCURACY_MAX_SPREAD = 0.2;
const HIGH_ACCURACY_MAX_SPREAD_LOGIN = 0.17;
const ENROLL_ANGLE_COUNT = 3;
const ENROLL_FRAMES_PER_ANGLE = 3;
const ENROLL_MIN_QUALITY_PERCENT = 50;
const ENROLL_STEP_PAUSE_MS = 900;

const KIOSK_EXTRACT_OPTIONS: FaceExtractOptions = {
  profileKind: "kiosk",
  minDetectionScore: 0.62,
  minFaceAreaRatio: 0.08,
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
  blockRetryUntilFaceAbsent = true,
  verifyRetryLabel,
  multiAngleEnroll: multiAngleEnrollProp,
  enrollCompareExisting = false,
  enrollTitle,
  enrollLead,
  onEnrolled,
  onVerified,
  onError,
}: Props) {
  const multiAngleEnroll =
    multiAngleEnrollProp ?? (mode === "enroll" && profileKind === "login");
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
  const blockRetryUntilFaceAbsentRef = useRef(blockRetryUntilFaceAbsent);
  blockRetryUntilFaceAbsentRef.current = blockRetryUntilFaceAbsent;
  const verifyRetryLabelRef = useRef(verifyRetryLabel);
  verifyRetryLabelRef.current = verifyRetryLabel;
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
  const [enrollStep, setEnrollStep] = useState(0);
  const [enrollQualityPct, setEnrollQualityPct] = useState(0);
  const [enrollMatchPct, setEnrollMatchPct] = useState<number | null>(null);
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollFrameCount, setEnrollFrameCount] = useState(0);
  const [enrollDone, setEnrollDone] = useState(false);

  const enrollStepRef = useRef(0);
  const enrollStepBufferRef = useRef<number[][]>([]);
  const enrollAllSamplesRef = useRef<number[][]>([]);
  const enrollPausedUntilRef = useRef(0);
  const enrollCompareExistingRef = useRef(enrollCompareExisting);
  enrollCompareExistingRef.current = enrollCompareExisting;
  enrollStepRef.current = enrollStep;

  const autoVerifyActive = mode === "verify" && autoVerify;
  const multiAngleEnrollActive = mode === "enroll" && multiAngleEnroll;

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

  const submitEnrollment = useCallback(
    async (samples: number[][]): Promise<boolean> => {
      const arr = averageFaceDescriptors(samples);
      if (!arr) return false;
      const v = videoRef.current;
      const previewUrl = v ? captureVideoFrameAsJpegDataUrl(v) : null;
      setEnrollSubmitting(true);
      try {
        const r = await fetch("/api/employee/face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descriptor: arr,
            ...(previewUrl ? { previewUrl } : {}),
          }),
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
        setEnrollDone(true);
        onEnrolledRef.current?.();
        return true;
      } catch {
        const msg = tRef.current("employee.faceEnrollFail");
        setStatus(msg);
        onErrorRef.current?.(msg);
        return false;
      } finally {
        setEnrollSubmitting(false);
      }
    },
    []
  );

  const finishClientVerify = useCallback(
    async (arr: number[], frameDescriptors?: number[][]): Promise<boolean> => {
      const verified = await onVerifiedRef.current?.(arr, { frameDescriptors });
      if (verified === false) {
        setStatus(verifyRetryLabelRef.current ?? tRef.current("employee.faceVerifyRetry"));
        if (scanWhenFaceVisible && blockRetryUntilFaceAbsentRef.current) {
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

  const finishServerVerify = useCallback(
    async (arr: number[]): Promise<boolean> => {
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
        if (scanWhenFaceVisible && blockRetryUntilFaceAbsentRef.current) {
          verifyBlockedUntilNoFaceRef.current = true;
        }
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
          profileKindRef.current === "kiosk"
            ? KIOSK_EXTRACT_OPTIONS
            : profileKindRef.current === "login"
              ? LOGIN_FACE_EXTRACT_OPTIONS
              : undefined;
        let arr: number[] | null = null;
        if (mode === "enroll" && multiAngleEnroll) {
          const msg = tRef.current("employee.faceEnrollUseAuto");
          setStatus(msg);
          onErrorRef.current?.(msg);
          return false;
        }
        if (mode === "enroll" && profileKindRef.current === "login") {
          const samples: number[][] = [];
          for (let i = 0; i < 3; i += 1) {
            if (i > 0) {
              await new Promise((r) => setTimeout(r, 150));
            }
            const sample = await extractFaceDescriptor(v, extractOpts);
            if (sample) samples.push(descriptorToArray(sample));
          }
          arr = averageFaceDescriptors(samples);
          if (!arr && samples.length > 0) {
            arr = samples[0]!;
          }
        } else {
          const desc = await extractFaceDescriptor(v, extractOpts);
          if (desc) arr = descriptorToArray(desc);
        }

        if (!arr) {
          if (!opts?.silentNoFace) {
            const msg = tRef.current("employee.faceNotDetected");
            setStatus(msg);
            onErrorRef.current?.(msg);
          } else {
            setStatus(tRef.current("employee.faceScanning"));
          }
          return false;
        }

        if (mode === "enroll") {
          return submitEnrollment([arr]);
        }

        if (verifyOnClientOnly) {
          return finishClientVerify(arr);
        }

        return finishServerVerify(arr);
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
    [disabled, mode, ready, verifyOnClientOnly, finishClientVerify, finishServerVerify, multiAngleEnroll, submitEnrollment]
  );

  useEffect(() => {
    if (!multiAngleEnrollActive || !ready || disabled || cameraError) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    async function completeEnrollStep(stepSamples: number[][]) {
      enrollAllSamplesRef.current.push(...stepSamples);
      enrollStepBufferRef.current = [];
      setEnrollFrameCount(0);

      if (enrollCompareExistingRef.current && enrollAllSamplesRef.current.length > 0) {
        const partial = averageFaceDescriptors(enrollAllSamplesRef.current);
        if (partial) {
          try {
            const r = await fetch("/api/employee/face", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ descriptor: partial }),
            });
            const j = (await r.json().catch(() => ({}))) as { confidencePercent?: number };
            if (!cancelled && typeof j.confidencePercent === "number") {
              setEnrollMatchPct(Math.round(j.confidencePercent));
            }
          } catch {
            /* optional */
          }
        }
      }

      const nextStep = enrollStepRef.current + 1;
      if (nextStep >= ENROLL_ANGLE_COUNT) {
        scanStoppedRef.current = true;
        setEnrollDone(true);
        setStatus(tRef.current("employee.faceEnrollSaving"));
        await submitEnrollment(enrollAllSamplesRef.current);
        return;
      }

      enrollStepRef.current = nextStep;
      setEnrollStep(nextStep);
      setStatus(tRef.current("employee.faceEnrollStepDone"));
      enrollPausedUntilRef.current = Date.now() + ENROLL_STEP_PAUSE_MS;
      schedule(ENROLL_STEP_PAUSE_MS);
    }

    async function tick() {
      if (cancelled || scanStoppedRef.current || disabled || !ready || cameraError || enrollSubmitting) {
        return;
      }
      if (Date.now() < enrollPausedUntilRef.current) {
        schedule(enrollPausedUntilRef.current - Date.now());
        return;
      }

      const v = videoRef.current;
      if (!v || busyRef.current) {
        schedule(AUTO_SCAN_INTERVAL_MS);
        return;
      }

      busyRef.current = true;
      try {
        const extracted = await extractFaceDetection(v, LOGIN_FACE_EXTRACT_OPTIONS);
        if (cancelled || scanStoppedRef.current) return;

        if (!extracted) {
          faceInFrameRef.current = false;
          setFaceInFrame(false);
          setEnrollQualityPct(0);
          setStatus(tRef.current("employee.faceScanIdle"));
          schedule(AUTO_SCAN_INTERVAL_MS_IDLE);
          return;
        }

        faceInFrameRef.current = true;
        setFaceInFrame(true);
        const sample = descriptorToArray(extracted.descriptor);
        enrollStepBufferRef.current.push(sample);
        setEnrollFrameCount(enrollStepBufferRef.current.length);

        const quality = computeCaptureQualityPercent(
          extracted.detectionScore,
          enrollStepBufferRef.current,
          HIGH_ACCURACY_MAX_SPREAD_LOGIN
        );
        setEnrollQualityPct(quality);

        if (enrollStepBufferRef.current.length < ENROLL_FRAMES_PER_ANGLE) {
          setStatus(
            tRef.current("employee.faceEnrollQuality").replace("{percent}", String(quality))
          );
          schedule(fastScan ? AUTO_SCAN_INTERVAL_MS_FAST : AUTO_SCAN_INTERVAL_MS);
          return;
        }

        const averaged = averageFaceDescriptors(enrollStepBufferRef.current);
        if (!averaged) {
          enrollStepBufferRef.current = [];
          schedule(AUTO_SCAN_INTERVAL_MS);
          return;
        }

        const spread = descriptorSpread(enrollStepBufferRef.current, averaged);
        if (spread > HIGH_ACCURACY_MAX_SPREAD_LOGIN || quality < ENROLL_MIN_QUALITY_PERCENT) {
          enrollStepBufferRef.current = enrollStepBufferRef.current.slice(-1);
          setStatus(tRef.current("employee.faceStabilizing"));
          schedule(AUTO_SCAN_INTERVAL_MS);
          return;
        }

        await completeEnrollStep([...enrollStepBufferRef.current]);
      } finally {
        busyRef.current = false;
      }
    }

    schedule(AUTO_SCAN_INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    multiAngleEnrollActive,
    ready,
    disabled,
    cameraError,
    fastScan,
    submitEnrollment,
    enrollSubmitting,
  ]);

  useEffect(() => {
    if (!multiAngleEnrollActive) return;
    enrollStepRef.current = 0;
    enrollStepBufferRef.current = [];
    enrollAllSamplesRef.current = [];
    enrollPausedUntilRef.current = 0;
    scanStoppedRef.current = false;
    setEnrollStep(0);
    setEnrollQualityPct(0);
    setEnrollMatchPct(null);
    setEnrollSubmitting(false);
    setEnrollFrameCount(0);
    setEnrollDone(false);
  }, [multiAngleEnrollActive]);

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
        const useHighAccuracy = highAccuracyScanRef.current && verifyOnClientOnly;
        const extracted = await extractFaceDetection(
          v,
          kind === "kiosk"
            ? KIOSK_EXTRACT_OPTIONS
            : kind === "login"
              ? LOGIN_FACE_EXTRACT_OPTIONS
              : undefined
        );
        const faceVisible = !!extracted;
        if (cancelled || scanStoppedRef.current) return;

        const wasInFrame = faceInFrameRef.current;
        faceInFrameRef.current = faceVisible;
        setFaceInFrame(faceVisible);

        if (!faceVisible) {
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

        if (useHighAccuracy) {
          qualityBufferRef.current.push(descriptorToArray(extracted.descriptor));
          const requiredFrames =
            profileKindRef.current === "kiosk"
              ? HIGH_ACCURACY_FRAME_COUNT_KIOSK
              : profileKindRef.current === "login"
                ? HIGH_ACCURACY_FRAME_COUNT_LOGIN
                : HIGH_ACCURACY_FRAME_COUNT;
          if (qualityBufferRef.current.length < requiredFrames) {
            setStatus(tRef.current("employee.faceStabilizing"));
            return;
          }

          const averaged = averageFaceDescriptors(qualityBufferRef.current);
          const sampled = [...qualityBufferRef.current];
          qualityBufferRef.current = [];
          if (!averaged) return;
          const spread = descriptorSpread(sampled, averaged);
          const maxSpread =
            profileKindRef.current === "login"
              ? HIGH_ACCURACY_MAX_SPREAD_LOGIN
              : HIGH_ACCURACY_MAX_SPREAD;
          if (spread > maxSpread) {
            setStatus(tRef.current("employee.faceStabilizing"));
            return;
          }

          busyRef.current = true;
          setBusy(true);
          try {
            await finishClientVerify(averaged, sampled);
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
          return;
        }

        busyRef.current = true;
        setBusy(true);
        try {
          const arr = descriptorToArray(extracted.descriptor);
          if (verifyOnClientOnly) {
            await finishClientVerify(arr);
          } else {
            await finishServerVerify(arr);
          }
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
        return;
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

    const initialDelay = fastScan ? AUTO_SCAN_INITIAL_DELAY_MS_FAST : AUTO_SCAN_INITIAL_DELAY_MS;
    const initial = setTimeout(() => {
      if (cancelled) return;
      const v = videoRef.current as VideoWithRvf | null;
      if (v?.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(onFrame);
      } else {
        void tick();
      }
    }, initialDelay);

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
    finishServerVerify,
  ]);

  const enrollStepLeadKeys = [
    "employee.faceEnrollStepFront",
    "employee.faceEnrollStepLeft",
    "employee.faceEnrollStepRight",
  ] as const;

  const title =
    mode === "enroll"
      ? (enrollTitle ?? t("employee.faceEnrollTitle"))
      : (verifyTitle ?? t("employee.faceVerifyTitle"));
  const lead =
    mode === "enroll"
      ? multiAngleEnrollActive
        ? t(enrollStepLeadKeys[enrollStep] ?? enrollStepLeadKeys[0])
        : (enrollLead ?? t("employee.faceEnrollLead"))
      : (verifyLead ?? t("employee.faceVerifyLead"));
  const buttonLabel =
    mode === "enroll"
      ? t("employee.faceEnrollButton")
      : (verifyButton ?? t("employee.faceVerifyButton"));
  const showManualButton = (mode === "enroll" && !multiAngleEnroll) || !autoVerify;

  function qualityColor(pct: number): string {
    if (pct >= 60) return "text-[var(--apple-green-dark)]";
    if (pct >= 40) return "text-[var(--apple-orange-dark)]";
    return "text-[var(--apple-red)]";
  }

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

      {multiAngleEnrollActive && !cameraError && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] font-medium text-[var(--apple-label-secondary)]">
          <span>
            {t("employee.faceEnrollStepProgress")
              .replace("{current}", String(enrollStep + 1))
              .replace("{total}", String(ENROLL_ANGLE_COUNT))}
          </span>
          <span className={qualityColor(enrollQualityPct)}>
            {t("employee.faceEnrollQuality").replace("{percent}", String(enrollQualityPct))}
          </span>
          {enrollMatchPct != null ? (
            <span className="text-[var(--apple-label-secondary)]">
              {t("employee.faceEnrollMatchExisting").replace("{percent}", String(enrollMatchPct))}
            </span>
          ) : null}
        </div>
      )}

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
          {multiAngleEnrollActive && ready && !cameraError && !enrollDone && (
            <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-center text-sm font-bold text-white">
              {enrollQualityPct}%
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
          {multiAngleEnrollActive && ready && !cameraError && !enrollDone && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded-full bg-black/55 px-3 py-1 text-center text-[0.6875rem] font-medium text-white">
              {enrollSubmitting
                ? t("employee.faceEnrollSaving")
                : !faceInFrame
                  ? t("employee.faceScanIdle")
                  : enrollFrameCount < ENROLL_FRAMES_PER_ANGLE
                    ? t("employee.faceStabilizing")
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
