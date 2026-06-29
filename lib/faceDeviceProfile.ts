/** 안면 인식용 기기·브라우저 프로필 (클라이언트 전용) */

export type FaceProfileKind = "default" | "kiosk";

export type FaceDeviceProfile = {
  /** iOS/iPadOS WebKit — WebGL fp16 이슈로 WASM 우선 */
  preferWasmBackend: boolean;
  /** tinyFaceDetector inputSize (작을수록 빠름, 정확도 약간↓) */
  detectorInputSize: number;
  detectorScoreThreshold: number;
  /** 인앱 브라우저 추정 (카메라 실패 시 안내용, 선차단 X) */
  likelyInAppBrowser: boolean;
  isMobile: boolean;
};

function isIosWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return navigator.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/KAKAOTALK|NAVER|Line\//i.test(ua)) return true;
  if (/Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok|Twitter|wv\)/i.test(ua)) return true;
  if (isIosWebKit()) {
    const isKnownBrowser = /Safari\//.test(ua) || /CriOS\/|FxiOS\/|EdgiOS\//.test(ua);
    return !isKnownBrowser;
  }
  return false;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isIosWebKit() || isAndroid()) return true;
  return /Mobi|Mobile/i.test(navigator.userAgent || "");
}

/** 기기별 감지·백엔드·입력 크기 튜닝 */
export function getFaceDeviceProfile(kind: FaceProfileKind = "default"): FaceDeviceProfile {
  const ios = isIosWebKit();
  const mobile = isMobileDevice();
  const android = isAndroid();

  if (kind === "kiosk") {
    return {
      preferWasmBackend: ios,
      detectorInputSize: ios ? 416 : 512,
      detectorScoreThreshold: 0.4,
      likelyInAppBrowser: isLikelyInAppBrowser(),
      isMobile: mobile,
    };
  }

  let detectorInputSize = 416;
  if (ios || (mobile && !android)) {
    detectorInputSize = 224;
  } else if (mobile || android) {
    detectorInputSize = 320;
  }

  return {
    preferWasmBackend: ios,
    detectorInputSize,
    detectorScoreThreshold: mobile ? 0.45 : 0.5,
    likelyInAppBrowser: isLikelyInAppBrowser(),
    isMobile: mobile,
  };
}

/** getUserMedia 제약 — 실패 시 더 느슨한 옵션으로 재시도 */
export function buildCameraConstraintAttempts(
  profile: FaceDeviceProfile,
  kind: FaceProfileKind = "default"
): MediaStreamConstraints[] {
  if (kind === "kiosk") {
    return [
      {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
        audio: false,
      },
      { video: { facingMode: { ideal: "user" } }, audio: false },
      { video: { facingMode: "user" }, audio: false },
      { video: true, audio: false },
    ];
  }

  const small = profile.isMobile;
  return [
    {
      video: {
        facingMode: { ideal: "user" },
        width: small ? { ideal: 480, min: 320 } : { ideal: 640 },
        height: small ? { ideal: 360, min: 240 } : { ideal: 480 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ];
}

export function hasCameraApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function isSecureForCamera(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

function isNotFoundCameraError(err: unknown): boolean {
  if (!(err instanceof DOMException || err instanceof Error)) return false;
  const name = err.name;
  if (name === "NotFoundError" || name === "OverconstrainedError") return true;
  return /device not found|requested device not found|no camera|not found/i.test(
    err.message ?? ""
  );
}

export type CameraAccessFailureKind = "no_camera" | "permission" | "in_use" | "other";

/** getUserMedia 실패를 UI용 종류·메시지로 분류 */
export function classifyCameraAccessError(
  err: unknown,
  profile: FaceDeviceProfile
): { kind: CameraAccessFailureKind; messageKey: string } {
  if (!isSecureForCamera()) {
    return { kind: "other", messageKey: "employee.faceInsecureContext" };
  }
  if (!hasCameraApi()) {
    return { kind: "other", messageKey: "employee.faceUnsupportedBrowser" };
  }
  if (err instanceof Error) {
    if (err.message.startsWith("FACE_MODELS_FAILED")) {
      return { kind: "other", messageKey: "employee.faceModelLoadFail" };
    }
    if (err.message === "FACE_BACKEND_UNAVAILABLE") {
      return { kind: "other", messageKey: "employee.faceBackendUnavailable" };
    }
  }
  if (isNotFoundCameraError(err)) {
    return { kind: "no_camera", messageKey: "employee.faceNoCamera" };
  }
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      kind: "permission",
      messageKey: profile.likelyInAppBrowser
        ? "employee.faceInAppBrowser"
        : "employee.faceCameraDenied",
    };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return { kind: "in_use", messageKey: "employee.faceCameraInUse" };
  }
  if (profile.likelyInAppBrowser) {
    return { kind: "other", messageKey: "employee.faceInAppBrowser" };
  }
  return { kind: "permission", messageKey: "employee.faceCameraDenied" };
}

/** enumerateDevices 로 영상 입력 장치 존재 여부 (권한 없을 때 빈 목록이면 unknown) */
export async function probeVideoInputDevice(): Promise<"yes" | "no" | "unknown"> {
  if (!hasCameraApi()) return "no";
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.length === 0) return "unknown";
    return devices.some((d) => d.kind === "videoinput") ? "yes" : "no";
  } catch {
    return "unknown";
  }
}
