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
  computeEnrollmentProgress,
  ENROLLMENT_ANALYSIS_INTERVAL_MS,
  ENROLLMENT_CAPTURE_COOLDOWN_MS,
  ENROLLMENT_SAMPLE_TARGET,
  isEnrollmentComplete,
  isFaceInGuideOval,
  nextNeededPose,
  validateEnrollmentCapture,
  type EnrollmentRejectReason,
  type EnrollmentSample,
} from "@/lib/faceEnrollment";
import {
  descriptorToArray,
  extractEnrollmentFrame,
  loadFaceModels,
} from "@/lib/faceRecognitionClient";
import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  profileKind?: FaceProfileKind;
  title?: string;
  onEnrolled?: () => void;
  onError?: (message: string) => void;
  onCancel?: () => void;
};

type EnrollPhase = "idle" | "loading" | "warming" | "collecting" | "saving" | "completed" | "error";

const REJECT_I18N: Record<EnrollmentRejectReason, string> = {
  NO_FACE: "employee.faceEnrollHintNoFace",
  MULTIPLE_FACES: "employee.faceEnrollHintMultiFace",
  TOO_SMALL: "employee.faceEnrollHintTooFar",
  TOO_CLOSE: "employee.faceEnrollHintTooClose",
  OUT_OF_GUIDE: "employee.faceEnrollHintOutOfGuide",
  TOO_DARK: "employee.faceEnrollHintTooDark",
  TOO_BRIGHT: "employee.faceEnrollHintTooBright",
  LOW_DETECTION: "employee.faceEnrollHintHoldStill",
  LOW_QUALITY: "employee.faceEnrollHintHoldStill",
  DUPLICATE: "employee.faceEnrollHintDuplicate",
  WRONG_PERSON: "employee.faceEnrollHintWrongPerson",
  POSE_NOT_NEEDED: "employee.faceEnrollHintPose",
  FRONT_VARIATION_TOO_SIMILAR: "employee.faceEnrollHintDuplicate",
};

const POSE_HINT_I18N: Record<string, string> = {
  FRONT: "employee.faceEnrollHintFront",
  LEFT_SLIGHT: "employee.faceEnrollHintLeft",
  RIGHT_SLIGHT: "employee.faceEnrollHintRight",
  UP_OR_VARIATION: "employee.faceEnrollHintVariation",
  FRONT_VARIATION: "employee.faceEnrollHintHold",
};

async function openCamera(profileKind: FaceProfileKind): Promise<MediaStream> {
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

export function FaceEnrollmentCapture({
  disabled,
  profileKind = "login",
  title,
  onEnrolled,
  onError,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<EnrollmentSample[]>([]);
  const referenceRef = useRef<number[] | null>(null);
  const lastCaptureAtRef = useRef(0);
  const savingRef = useRef(false);
  const scanStoppedRef = useRef(false);

  const [phase, setPhase] = useState<EnrollPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorKind, setCameraErrorKind] = useState<CameraAccessFailureKind | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [collectedCount, setCollectedCount] = useState(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const poseHint = useCallback((samples: EnrollmentSample[]) => {
    const needed = nextNeededPose(samples);
    if (!needed) return tRef.current("employee.faceEnrollHintHold");
    return tRef.current(POSE_HINT_I18N[needed] ?? "employee.faceEnrollHintFront");
  }, []);

  const submitBatch = useCallback(
    async (samples: EnrollmentSample[]) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setPhase("saving");
      setHint(tRef.current("employee.faceEnrollSaving"));

      const v = videoRef.current;
      const previewUrl = v ? captureVideoFrameAsJpegDataUrl(v) : null;

      try {
        const r = await fetch("/api/employee/face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            samples: samples.map((s) => ({
              descriptor: s.descriptor,
              poseType: s.poseType,
              qualityScore: s.qualityScore,
            })),
            ...(previewUrl ? { previewUrl } : {}),
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg =
            typeof j.error === "string" ? j.error : tRef.current("employee.faceEnrollFail");
          setPhase("error");
          setHint(msg);
          onError?.(msg);
          savingRef.current = false;
          return;
        }
        scanStoppedRef.current = true;
        stopCamera();
        setPhase("completed");
        setProgress(100);
        setHint(tRef.current("employee.faceEnrollCompleted"));
        onEnrolled?.();
      } catch {
        const msg = tRef.current("employee.faceEnrollFail");
        setPhase("error");
        setHint(msg);
        onError?.(msg);
        savingRef.current = false;
      }
    },
    [onEnrolled, onError, stopCamera]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSecureForCamera()) {
        setCameraError(tRef.current("employee.faceInsecureContext"));
        setCameraErrorKind("other");
        setPhase("error");
        return;
      }
      if (!hasCameraApi()) {
        setCameraError(tRef.current("employee.faceUnsupportedBrowser"));
        setCameraErrorKind("other");
        setPhase("error");
        return;
      }
      const videoProbe = await probeVideoInputDevice();
      if (videoProbe === "no") {
        setCameraError(tRef.current("employee.faceNoCamera"));
        setCameraErrorKind("no_camera");
        setPhase("error");
        return;
      }

      setPhase("loading");
      samplesRef.current = [];
      referenceRef.current = null;
      lastCaptureAtRef.current = 0;
      savingRef.current = false;
      scanStoppedRef.current = false;
      setProgress(0);
      setCollectedCount(0);
      setHint(tRef.current("employee.faceEnrollHintFront"));

      try {
        await loadFaceModels();
        const stream = await openCamera(profileKind);
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.muted = true;
          video.play().then(
            () => setNeedsTap(false),
            () => setNeedsTap(true)
          );
        }
        setPhase("warming");
        setTimeout(() => {
          if (!cancelled) setPhase("collecting");
        }, 400);
      } catch (err) {
        const classified = classifyCameraAccessError(err, getFaceDeviceProfile(profileKind));
        setCameraError(tRef.current(classified.messageKey));
        setCameraErrorKind(classified.kind);
        setPhase("error");
      }
    }

    void init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [profileKind, stopCamera]);

  useEffect(() => {
    if (phase !== "collecting" || disabled || cameraError) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    async function tick() {
      if (cancelled || scanStoppedRef.current || savingRef.current || disabled) return;

      const v = videoRef.current;
      if (!v || v.readyState < 2) {
        schedule(ENROLLMENT_ANALYSIS_INTERVAL_MS);
        return;
      }

      const frame = await extractEnrollmentFrame(v, { profileKind: "login", minDetectionScore: 0 });
      if (cancelled || scanStoppedRef.current) return;

      const samples = samplesRef.current;
      const width = v.videoWidth || v.clientWidth;
      const height = v.videoHeight || v.clientHeight;

      if (!frame || frame.faceCount === 0) {
        setHint(tRef.current(REJECT_I18N.NO_FACE));
        schedule(ENROLLMENT_ANALYSIS_INTERVAL_MS);
        return;
      }

      if (frame.faceCount > 1) {
        setHint(tRef.current(REJECT_I18N.MULTIPLE_FACES));
        schedule(ENROLLMENT_ANALYSIS_INTERVAL_MS);
        return;
      }

      const inGuide = isFaceInGuideOval(frame.box, width, height, { mirrorPreview: true });
      const metrics = {
        detectionScore: frame.detectionScore,
        faceCount: frame.faceCount,
        areaRatio: frame.areaRatio,
        brightness: frame.brightness,
        inGuideOval: inGuide,
        yaw: frame.yaw,
        pitch: frame.pitch,
      };

      const descriptor = descriptorToArray(frame.descriptor);
      const validated = validateEnrollmentCapture(
        descriptor,
        metrics,
        samples,
        referenceRef.current
      );

      if (!validated.ok) {
        const rejectHint = tRef.current(REJECT_I18N[validated.reason]);
        const guideHint =
          validated.reason === "POSE_NOT_NEEDED" ? poseHint(samples) : null;
        setHint(guideHint && guideHint !== rejectHint ? `${guideHint} ${rejectHint}` : rejectHint);
        setProgress(computeEnrollmentProgress(samples));
        schedule(ENROLLMENT_ANALYSIS_INTERVAL_MS);
        return;
      }

      setHint(poseHint([...samples, validated.sample]));

      const now = Date.now();
      if (now - lastCaptureAtRef.current < ENROLLMENT_CAPTURE_COOLDOWN_MS) {
        setHint(poseHint(samples));
        schedule(ENROLLMENT_CAPTURE_COOLDOWN_MS - (now - lastCaptureAtRef.current));
        return;
      }

      lastCaptureAtRef.current = now;
      if (!referenceRef.current) {
        referenceRef.current = validated.sample.descriptor;
      }
      samplesRef.current = [...samples, validated.sample];
      setCollectedCount(samplesRef.current.length);
      const pct = computeEnrollmentProgress(samplesRef.current);
      setProgress(pct);
      setHint(poseHint(samplesRef.current));

      setCaptureFlash(true);
      window.setTimeout(() => setCaptureFlash(false), 280);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(20);
        } catch {
          /* ignore */
        }
      }

      if (isEnrollmentComplete(samplesRef.current)) {
        await submitBatch(samplesRef.current);
        return;
      }

      schedule(ENROLLMENT_CAPTURE_COOLDOWN_MS);
    }

    schedule(ENROLLMENT_ANALYSIS_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, disabled, cameraError, profileKind, poseHint, submitBatch]);

  const displayTitle = title ?? t("employee.faceEnrollTitle");

  if (cameraErrorKind === "no_camera" && cameraError) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border-2 border-[var(--apple-red)] bg-[color-mix(in_srgb,var(--apple-red)_12%,var(--grouped-bg))] px-4 py-6 text-center shadow-sm">
        <p className="text-sm font-medium leading-relaxed text-[var(--apple-red)]">{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--grouped-bg)] p-3 shadow-sm ring-1 ring-black/[0.04] sm:p-4">
      <p className="text-sm font-semibold text-[var(--foreground)] sm:text-base">{displayTitle}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] font-medium">
        <span className="text-[var(--apple-label-secondary)]">
          {t("employee.faceEnrollStepProgress")
            .replace("{current}", String(Math.min(collectedCount + 1, ENROLLMENT_SAMPLE_TARGET)))
            .replace("{total}", String(ENROLLMENT_SAMPLE_TARGET))}
        </span>
        <span className="text-[var(--foreground)]">
          {t("employee.faceEnrollCompleteness").replace("{percent}", String(progress))}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--fill-tertiary)]">
        <div
          className="h-full rounded-full bg-[var(--apple-blue)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {hint && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--apple-label-secondary)] sm:text-sm">
          {hint}
        </p>
      )}

      {cameraError ? (
        <p className="mt-3 text-sm text-[var(--apple-red)]">{cameraError}</p>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full -scale-x-100 object-cover"
            playsInline
            muted
            autoPlay
            aria-hidden
            onClick={() => {
              const v = videoRef.current;
              if (v?.paused) void v.play().then(() => setNeedsTap(false)).catch(() => {});
            }}
          />
          <div
            className={`pointer-events-none absolute inset-8 rounded-[50%] border-2 border-dashed transition-colors duration-200 ${
              captureFlash ? "border-[var(--apple-green)] border-solid" : "border-white/70"
            }`}
            aria-hidden
          />
          {captureFlash && (
            <div className="pointer-events-none absolute inset-8 flex items-center justify-center">
              <span className="rounded-full bg-[var(--apple-green)]/90 px-2 py-0.5 text-lg text-white">
                ✓
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1 text-lg font-bold text-white">
              {progress}%
            </span>
          </div>
          {(phase === "loading" || phase === "warming") && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-white">
              {phase === "loading"
                ? t("employee.faceOpeningCamera")
                : t("employee.faceLoadingModels")}
            </div>
          )}
          {phase === "saving" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
              {t("employee.faceEnrollSaving")}
            </div>
          )}
          {needsTap && phase === "collecting" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-white/85 px-3 py-1 text-[0.6875rem] font-semibold">
              {t("employee.faceTapToStart")}
            </div>
          )}
        </div>
      )}

      {onCancel && phase !== "saving" && phase !== "completed" ? (
        <button
          type="button"
          className="mt-3 flex min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-[var(--separator)] bg-[var(--fill-tertiary)] text-sm font-semibold text-[var(--foreground)]"
          onClick={onCancel}
          disabled={disabled || phase === "saving"}
        >
          {t("account.faceCancelReEnroll")}
        </button>
      ) : null}
    </div>
  );
}
