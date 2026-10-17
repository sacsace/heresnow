/**
 * Face identity policy — env + optional per-company overrides.
 * Distance metric: Euclidean on L2-normalized 128-d descriptors (lower = more similar).
 */

export type FaceIdentityPolicy = {
  /** Absolute match threshold (Euclidean distance, lower = stricter match) */
  matchThreshold: number;
  /** Login 1:N — same as matchThreshold unless overridden */
  loginMatchThreshold: number;
  /** Door terminal 1:N — often slightly stricter */
  doorMatchThreshold: number;
  /** Min gap between best and second-best employee (1:N) */
  identityMinMargin: number;
  /** Min templates under threshold for same employee (1:1 and per-employee 1:N score) */
  minTemplateMatches: number;
  /** Soft conflict: template distance below this counts as a hit */
  enrollConflictMaxDistance: number;
  /** Hard conflict: a single template below this always blocks enrollment */
  enrollConflictHardMaxDistance: number;
  /** Soft conflict needs at least this many templates under soft max */
  enrollConflictMinTemplateHits: number;
  /** Multi-frame: min frames agreeing on same employee */
  multiFrameRequiredMatches: number;
  /** Multi-frame: total frames expected */
  multiFrameTotal: number;
  /** Enrollment same-person max distance vs reference sample */
  enrollmentSamePersonMaxDistance: number;
  /** Login — minimum match confidence % (distance-derived; not detection score) */
  loginMinConfidencePercent: number;
  /** 출퇴근 1:1 — 유클리드 거리 상한 (이보다 멀면 무조건 거절) */
  punchMatchThreshold: number;
  /**
   * 출퇴근 인식률 % 계산 기준 거리 (이 거리=0%).
   * confidence = (1 - distance / punchConfidenceReference) * 100
   */
  punchConfidenceReference: number;
  /** 출퇴근 최소 인식률 % — 이보다 낮으면 체크인 불가 (20~40% 통과 방지) */
  punchMinConfidencePercent: number;
  punchMinTemplateMatches: number;
};

const DEFAULT_POLICY: FaceIdentityPolicy = {
  matchThreshold: parseEnvFloat("FACE_MATCH_THRESHOLD", 0.4),
  loginMatchThreshold: parseEnvFloat("FACE_LOGIN_MATCH_THRESHOLD", 0.38),
  doorMatchThreshold: parseEnvFloat("FACE_DOOR_MATCH_THRESHOLD", 0.38),
  loginMinConfidencePercent: parseEnvInt("FACE_LOGIN_MIN_CONFIDENCE_PERCENT", 60),
  identityMinMargin: parseEnvFloat("FACE_IDENTITY_MIN_MARGIN", 0.12),
  minTemplateMatches: parseEnvInt("FACE_MIN_TEMPLATE_MATCHES", 2),
  enrollConflictMaxDistance: parseEnvFloat("FACE_ENROLL_CONFLICT_MAX_DISTANCE", 0.35),
  enrollConflictHardMaxDistance: parseEnvFloat("FACE_ENROLL_CONFLICT_HARD_MAX_DISTANCE", 0.28),
  enrollConflictMinTemplateHits: parseEnvInt("FACE_ENROLL_CONFLICT_MIN_TEMPLATE_HITS", 2),
  multiFrameRequiredMatches: parseEnvInt("FACE_MULTIFRAME_REQUIRED", 3),
  multiFrameTotal: parseEnvInt("FACE_MULTIFRAME_TOTAL", 5),
  enrollmentSamePersonMaxDistance: parseEnvFloat("FACE_ENROLL_SAME_PERSON_MAX", 0.4),
  /**
   * 절대 거리 상한 (face-api 동일인 통상 0.25~0.45).
   * 이보다 멀면 인식률과 무관하게 거절.
   */
  punchMatchThreshold: parseEnvFloat("FACE_PUNCH_MATCH_THRESHOLD", 0.48),
  /**
   * 인식률 % 스케일 — distance 0 → 100%, reference → 0%.
   * 동일인 거리 0.35≈74%, 0.40≈70%, 0.54≈60%
   */
  punchConfidenceReference: parseEnvFloat("FACE_PUNCH_CONFIDENCE_REFERENCE", 1.35),
  punchMinConfidencePercent: parseEnvInt("FACE_PUNCH_MIN_CONFIDENCE_PERCENT", 60),
  punchMinTemplateMatches: parseEnvInt("FACE_PUNCH_MIN_TEMPLATE_MATCHES", 1),
};

export type CompanyFacePolicyOverrides = {
  faceMatchThreshold?: number | null;
  faceIdentityMinMargin?: number | null;
  faceMinTemplateMatches?: number | null;
};

function parseEnvFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function resolveFaceIdentityPolicy(
  company?: CompanyFacePolicyOverrides | null
): FaceIdentityPolicy {
  const base = { ...DEFAULT_POLICY };
  if (company?.faceMatchThreshold != null && Number.isFinite(company.faceMatchThreshold)) {
    const t = company.faceMatchThreshold;
    base.matchThreshold = t;
    base.loginMatchThreshold = t;
    base.doorMatchThreshold = Math.min(t, base.doorMatchThreshold);
  }
  if (company?.faceIdentityMinMargin != null && Number.isFinite(company.faceIdentityMinMargin)) {
    base.identityMinMargin = company.faceIdentityMinMargin;
  }
  if (company?.faceMinTemplateMatches != null && Number.isFinite(company.faceMinTemplateMatches)) {
    base.minTemplateMatches = Math.max(1, Math.floor(company.faceMinTemplateMatches));
  }
  return base;
}

/** @deprecated use policy.matchThreshold — kept for gradual migration */
export function defaultMatchThreshold(): number {
  return DEFAULT_POLICY.matchThreshold;
}
