import { euclideanDistance, FACE_MATCH_THRESHOLD } from "@/lib/faceMatch";

/** 등록에 필요한 유효 샘플 수 */
export const ENROLLMENT_SAMPLE_TARGET = 5;

export const ENROLLMENT_CAPTURE_COOLDOWN_MS = 900;
export const ENROLLMENT_ANALYSIS_INTERVAL_MS = 125;

export const ENROLLMENT_SAME_PERSON_MAX_DISTANCE = FACE_MATCH_THRESHOLD;
export const ENROLLMENT_DUPLICATE_MAX_DISTANCE = 0.18;
export const ENROLLMENT_FRONT_VARIATION_MIN_DISTANCE = 0.12;

export const ENROLLMENT_MIN_QUALITY = 0.32;
export const ENROLLMENT_MIN_DETECTION = 0.35;
export const ENROLLMENT_MIN_AREA_RATIO = 0.02;
export const ENROLLMENT_MAX_AREA_RATIO = 0.55;
export const ENROLLMENT_MIN_BRIGHTNESS = 0.12;
export const ENROLLMENT_MAX_BRIGHTNESS = 0.93;

export type EnrollmentPoseType =
  | "FRONT"
  | "LEFT_SLIGHT"
  | "RIGHT_SLIGHT"
  | "UP_OR_VARIATION"
  | "FRONT_VARIATION";

export const REQUIRED_ENROLLMENT_POSES: EnrollmentPoseType[] = [
  "FRONT",
  "LEFT_SLIGHT",
  "RIGHT_SLIGHT",
  "UP_OR_VARIATION",
  "FRONT_VARIATION",
];

export type EnrollmentSample = {
  descriptor: number[];
  poseType: EnrollmentPoseType;
  qualityScore: number;
  yaw: number;
  pitch: number;
};

export type EnrollmentFrameMetrics = {
  detectionScore: number;
  faceCount: number;
  areaRatio: number;
  brightness: number;
  inGuideOval: boolean;
  yaw: number;
  pitch: number;
};

export type EnrollmentRejectReason =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "TOO_SMALL"
  | "TOO_CLOSE"
  | "OUT_OF_GUIDE"
  | "TOO_DARK"
  | "TOO_BRIGHT"
  | "LOW_DETECTION"
  | "LOW_QUALITY"
  | "DUPLICATE"
  | "WRONG_PERSON"
  | "POSE_NOT_NEEDED"
  | "FRONT_VARIATION_TOO_SIMILAR";

export function classifyPose(yaw: number, pitch: number): EnrollmentPoseType | null {
  const absYaw = Math.abs(yaw);
  const absPitch = Math.abs(pitch);

  if (yaw <= -12 && yaw >= -35) return "LEFT_SLIGHT";
  if (yaw >= 12 && yaw <= 35) return "RIGHT_SLIGHT";

  if (absYaw <= 18) {
    if (pitch <= -12 || pitch >= 18) return "UP_OR_VARIATION";
    if (absYaw <= 10 && absPitch <= 14) return "FRONT";
    return "FRONT_VARIATION";
  }

  if (absPitch >= 14) return "UP_OR_VARIATION";
  return "FRONT_VARIATION";
}

/** 현재 필요 pose에 실제 분류 pose를 매핑 (1단계 정면은 관대하게) */
export function resolveEffectivePose(
  poseType: EnrollmentPoseType,
  needed: EnrollmentPoseType | null
): EnrollmentPoseType | null {
  if (!needed) return poseType;
  if (poseType === needed) return poseType;

  if (needed === "FRONT") {
    if (
      poseType === "FRONT_VARIATION" ||
      poseType === "UP_OR_VARIATION"
    ) {
      return "FRONT";
    }
  }
  if (needed === "FRONT_VARIATION") {
    if (poseType === "FRONT" || poseType === "UP_OR_VARIATION") return "FRONT_VARIATION";
  }
  if (needed === "UP_OR_VARIATION" && poseType === "FRONT") {
    return "UP_OR_VARIATION";
  }

  return null;
}

export function computeQualityScore(metrics: EnrollmentFrameMetrics): number {
  const det = metrics.detectionScore;
  const sizeScore = Math.max(
    0,
    Math.min(1, (metrics.areaRatio - ENROLLMENT_MIN_AREA_RATIO) / 0.28)
  );
  const brightOk =
    metrics.brightness >= ENROLLMENT_MIN_BRIGHTNESS &&
    metrics.brightness <= ENROLLMENT_MAX_BRIGHTNESS;
  const brightScore = brightOk ? 1 : 0.25;
  const centerScore = metrics.inGuideOval ? 1 : 0;
  return Math.max(0, Math.min(1, det * 0.5 + sizeScore * 0.2 + brightScore * 0.15 + centerScore * 0.15));
}

/** CSS 미러(-scale-x-100) 미리보기와 좌표를 맞추기 위해 box X 반전 */
export function mirrorFaceBox(
  box: { x: number; y: number; width: number; height: number },
  frameWidth: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: frameWidth - box.x - box.width,
    y: box.y,
    width: box.width,
    height: box.height,
  };
}

export function isFaceInGuideOval(
  box: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
  options?: { mirrorPreview?: boolean }
): boolean {
  if (frameWidth <= 0 || frameHeight <= 0) return false;
  const b = options?.mirrorPreview ? mirrorFaceBox(box, frameWidth) : box;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  // UI 타원(inset-8)과 유사 — 가로·세로 여유
  const inCenter =
    cx >= frameWidth * 0.1 &&
    cx <= frameWidth * 0.9 &&
    cy >= frameHeight * 0.18 &&
    cy <= frameHeight * 0.88;
  const notClipped =
    b.x >= -b.width * 0.1 &&
    b.y >= -b.height * 0.1 &&
    b.x + b.width <= frameWidth * 1.1 &&
    b.y + b.height <= frameHeight * 1.1;
  const faceTallEnough = b.height >= frameHeight * 0.09;
  return inCenter && notClipped && faceTallEnough;
}

export function coveredPoses(samples: EnrollmentSample[]): Set<EnrollmentPoseType> {
  return new Set(samples.map((s) => s.poseType));
}

export function nextNeededPose(samples: EnrollmentSample[]): EnrollmentPoseType | null {
  const covered = coveredPoses(samples);
  for (const pose of REQUIRED_ENROLLMENT_POSES) {
    if (!covered.has(pose)) return pose;
  }
  return null;
}

/** 등록 완성도 0~100 — 인식 정확도가 아님 */
export function computeEnrollmentProgress(samples: EnrollmentSample[]): number {
  const covered = coveredPoses(samples);
  let filled = 0;
  for (const pose of REQUIRED_ENROLLMENT_POSES) {
    if (covered.has(pose)) filled += 1;
  }
  if (filled < ENROLLMENT_SAMPLE_TARGET) {
    return Math.round((filled / ENROLLMENT_SAMPLE_TARGET) * 100);
  }
  const avgQ = samples.reduce((a, s) => a + s.qualityScore, 0) / samples.length;
  if (avgQ < ENROLLMENT_MIN_QUALITY) return 80;
  return 100;
}

export function isEnrollmentComplete(samples: EnrollmentSample[]): boolean {
  return computeEnrollmentProgress(samples) >= 100;
}

function isDuplicateSample(
  descriptor: number[],
  samples: EnrollmentSample[],
  poseType: EnrollmentPoseType
): boolean {
  for (const s of samples) {
    const dist = euclideanDistance(descriptor, s.descriptor);
    if (dist < ENROLLMENT_DUPLICATE_MAX_DISTANCE) {
      if (s.poseType === poseType) return true;
      if (poseType !== "FRONT_VARIATION" && s.poseType !== "FRONT_VARIATION") return true;
    }
  }
  return false;
}

function frontVariationOk(
  descriptor: number[],
  samples: EnrollmentSample[]
): boolean {
  const front = samples.find((s) => s.poseType === "FRONT");
  if (!front) return true;
  return euclideanDistance(descriptor, front.descriptor) >= ENROLLMENT_FRONT_VARIATION_MIN_DISTANCE;
}

/** 캡처 후보 검증 — 통과 시 EnrollmentSample 반환 */
export function validateEnrollmentCapture(
  descriptor: number[],
  metrics: EnrollmentFrameMetrics,
  samples: EnrollmentSample[],
  referenceDescriptor: number[] | null
): { ok: true; sample: EnrollmentSample } | { ok: false; reason: EnrollmentRejectReason } {
  if (metrics.faceCount === 0) return { ok: false, reason: "NO_FACE" };
  if (metrics.faceCount > 1) return { ok: false, reason: "MULTIPLE_FACES" };
  if (metrics.areaRatio < ENROLLMENT_MIN_AREA_RATIO) return { ok: false, reason: "TOO_SMALL" };
  if (metrics.areaRatio > ENROLLMENT_MAX_AREA_RATIO) return { ok: false, reason: "TOO_CLOSE" };
  if (!metrics.inGuideOval) return { ok: false, reason: "OUT_OF_GUIDE" };
  if (metrics.brightness < ENROLLMENT_MIN_BRIGHTNESS) return { ok: false, reason: "TOO_DARK" };
  if (metrics.brightness > ENROLLMENT_MAX_BRIGHTNESS) return { ok: false, reason: "TOO_BRIGHT" };
  if (metrics.detectionScore < ENROLLMENT_MIN_DETECTION) {
    return { ok: false, reason: "LOW_DETECTION" };
  }

  const qualityScore = computeQualityScore(metrics);
  if (qualityScore < ENROLLMENT_MIN_QUALITY) return { ok: false, reason: "LOW_QUALITY" };

  const poseType = classifyPose(metrics.yaw, metrics.pitch);
  if (!poseType) return { ok: false, reason: "POSE_NOT_NEEDED" };

  const needed = nextNeededPose(samples);
  const effectivePose = resolveEffectivePose(poseType, needed);
  if (needed && !effectivePose) {
    return { ok: false, reason: "POSE_NOT_NEEDED" };
  }
  const storedPose = effectivePose ?? poseType;

  if (referenceDescriptor) {
    if (euclideanDistance(descriptor, referenceDescriptor) >= ENROLLMENT_SAME_PERSON_MAX_DISTANCE) {
      return { ok: false, reason: "WRONG_PERSON" };
    }
  }

  if (isDuplicateSample(descriptor, samples, storedPose)) {
    return { ok: false, reason: "DUPLICATE" };
  }

  if (storedPose === "FRONT_VARIATION" && !frontVariationOk(descriptor, samples)) {
    return { ok: false, reason: "FRONT_VARIATION_TOO_SIMILAR" };
  }

  return {
    ok: true,
    sample: {
      descriptor,
      poseType: storedPose,
      qualityScore,
      yaw: metrics.yaw,
      pitch: metrics.pitch,
    },
  };
}

/** 서버 — 샘플 간 동일인·포즈·품질 검증 */
export function validateEnrollmentBatch(samples: EnrollmentSample[]): string | null {
  if (samples.length < ENROLLMENT_SAMPLE_TARGET) {
    return `최소 ${ENROLLMENT_SAMPLE_TARGET}개의 유효 샘플이 필요합니다.`;
  }

  const covered = coveredPoses(samples);
  for (const pose of REQUIRED_ENROLLMENT_POSES) {
    if (!covered.has(pose)) {
      return "필요한 얼굴 각도 샘플이 부족합니다. 다시 등록해 주세요.";
    }
  }

  for (const s of samples) {
    if (s.qualityScore < ENROLLMENT_MIN_QUALITY - 0.05) {
      return "샘플 품질이 기준에 미달합니다.";
    }
  }

  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const d = euclideanDistance(samples[i]!.descriptor, samples[j]!.descriptor);
      if (d >= ENROLLMENT_SAME_PERSON_MAX_DISTANCE + 0.08) {
        return "등록 샘플 간 동일인 검증에 실패했습니다.";
      }
    }
  }

  const avgQ = samples.reduce((a, s) => a + s.qualityScore, 0) / samples.length;
  if (avgQ < ENROLLMENT_MIN_QUALITY) {
    return "평균 품질이 기준에 미달합니다.";
  }

  return null;
}
