/** 안면 인식용 기기·브라우저 프로필 (클라이언트 전용) */

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
export function getFaceDeviceProfile(): FaceDeviceProfile {
  const ios = isIosWebKit();
  const mobile = isMobileDevice();
  const android = isAndroid();

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
export function buildCameraConstraintAttempts(profile: FaceDeviceProfile): MediaStreamConstraints[] {
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
