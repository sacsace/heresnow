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
  onEnrolled?: () => void;
  onVerified?: (descriptor: number[]) => void;
  onError?: (message: string) => void;
};

type InitPhase = "idle" | "loading-models" | "starting-camera" | "ready" | "error";

export function FaceCapture({ mode, disabled, onEnrolled, onVerified, onError }: Props) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<InitPhase>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

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
      const ios = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !== undefined && ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1);
      if (!ios) return false;
      return /KAKAOTALK|NAVER|Line\//i.test(ua) ||
        /Instagram|FBAN|FBAV|FB_IAB|Snapchat|Twitter|TikTok|wv\)/i.test(ua) ||
        (!/Safari\//.test(ua) && !/CriOS\/|FxiOS\/|EdgiOS\//.test(ua));
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
          // iOS Safari는 srcObject 직후 await play()가 거부되는 경우가 잦음.
          // 거부 시 사용자에게 "탭하여 시작" 안내(needsTap) — 실제로는 캡처 버튼 탭에서도 자동 재시도된다.
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
    // tRef.current 사용 — 로케일 전환 시 카메라 재시작 방지
  }, [stopCamera]);

  /**
   * iOS Safari 안전망 — onLoadedMetadata / onCanPlay 가 끝내 발생하지 않는 드문 케이스 대비.
   * 스트림이 붙은 뒤 5초 동안 video.readyState 를 폴링해서 강제로 ready 처리한다.
   */
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

  async function capture() {
    if (!videoRef.current || !ready || busy || disabled) return;
    setBusy(true);
    setStatus(null);
    try {
      // iOS Safari: 첫 사용자 제스처 시점에 다시 한번 play() — 정책상 여기서는 거의 항상 성공.
      const v = videoRef.current;
      if (v.paused) {
        try {
          await v.play();
        } catch (e) {
          console.warn("[face] play() on capture failed", e);
        }
      }
      const desc = await extractFaceDescriptor(v);
      if (!desc) {
        const msg = t("employee.faceNotDetected");
        setStatus(msg);
        onError?.(msg);
        setBusy(false);
        return;
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
          const msg = typeof j.error === "string" ? j.error : t("employee.faceEnrollFail");
          setStatus(msg);
          onError?.(msg);
          setBusy(false);
          return;
        }
        setStatus(t("employee.faceEnrollOk"));
        onEnrolled?.();
      } else {
        const r = await fetch("/api/employee/face", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptor: arr }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof j.error === "string" ? j.error : t("employee.faceVerifyFail");
          setStatus(msg);
          onError?.(msg);
          setBusy(false);
          return;
        }
        setStatus(t("employee.faceVerifyOk"));
        onVerified?.(arr);
      }
    } catch {
      const msg = t("employee.faceProcessFail");
      setStatus(msg);
      onError?.(msg);
    }
    setBusy(false);
  }

  const title = mode === "enroll" ? t("employee.faceEnrollTitle") : t("employee.faceVerifyTitle");
  const lead = mode === "enroll" ? t("employee.faceEnrollLead") : t("employee.faceVerifyLead");
  const buttonLabel =
    mode === "enroll" ? t("employee.faceEnrollButton") : t("employee.faceVerifyButton");

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
          {needsTap && phase !== "loading-models" && phase !== "starting-camera" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit max-w-[90%] rounded-full bg-white/85 px-3 py-1 text-center text-[0.6875rem] font-semibold text-[var(--foreground)]">
              {t("employee.faceTapToStart")}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!ready || busy || disabled || !!cameraError}
        onClick={() => void capture()}
        className="mt-3 flex min-h-[3rem] w-full touch-manipulation items-center justify-center rounded-xl bg-[var(--apple-blue)] py-3 text-base font-semibold text-white hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-50"
      >
        {busy ? t("employee.faceProcessing") : buttonLabel}
      </button>
      {status && <p className="mt-2 text-center text-sm text-[var(--apple-label-secondary)]">{status}</p>}
    </div>
  );
}
