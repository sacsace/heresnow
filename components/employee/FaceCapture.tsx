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

export function FaceCapture({ mode, disabled, onEnrolled, onVerified, onError }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    function deriveErrorMessage(err: unknown): string {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        return t("employee.faceInsecureContext");
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        return t("employee.faceUnsupportedBrowser");
      }
      if (err instanceof Error) {
        if (err.message.startsWith("FACE_MODELS_FAILED")) {
          return t("employee.faceModelLoadFail");
        }
        if (err.message === "FACE_BACKEND_UNAVAILABLE") {
          return t("employee.faceBackendUnavailable");
        }
        switch (err.name) {
          case "NotAllowedError":
          case "SecurityError":
            return t("employee.faceCameraDenied");
          case "NotFoundError":
          case "OverconstrainedError":
            return t("employee.faceNoCamera");
          case "NotReadableError":
          case "AbortError":
            return t("employee.faceCameraInUse");
          case "TypeError":
            return t("employee.faceUnsupportedBrowser");
        }
      }
      return t("employee.faceCameraDenied");
    }

    async function init() {
      // 보안 컨텍스트(HTTPS/localhost) 사전 체크 — 그렇지 않으면 getUserMedia 호출 자체가 막힘
      if (typeof window !== "undefined" && !window.isSecureContext) {
        if (!cancelled) setCameraError(t("employee.faceInsecureContext"));
        return;
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        if (!cancelled) setCameraError(t("employee.faceUnsupportedBrowser"));
        return;
      }

      try {
        await loadFaceModels();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
        setCameraError(null);
      } catch (err) {
        console.error("[face] init failed", err);
        if (!cancelled) {
          setCameraError(deriveErrorMessage(err));
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera, t]);

  async function capture() {
    if (!videoRef.current || !ready || busy || disabled) return;
    setBusy(true);
    setStatus(null);
    try {
      const desc = await extractFaceDescriptor(videoRef.current);
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
            className="aspect-[4/3] w-full -scale-x-100 object-cover"
            playsInline
            muted
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-8 rounded-[50%] border-2 border-dashed border-white/70"
            aria-hidden
          />
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
