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
  /** Block enrolling face too close to another employee */
  enrollConflictMaxDistance: number;
  /** Multi-frame: min frames agreeing on same employee */
  multiFrameRequiredMatches: number;
  /** Multi-frame: total frames expected */
  multiFrameTotal: number;
  /** Enrollment same-person max distance vs reference sample */
  enrollmentSamePersonMaxDistance: number;
  /** Login — minimum match confidence % (distance-derived; not detection score) */
  loginMinConfidencePercent: number;
};

const DEFAULT_POLICY: FaceIdentityPolicy = {
  matchThreshold: parseEnvFloat("FACE_MATCH_THRESHOLD", 0.42),
  loginMatchThreshold: parseEnvFloat("FACE_LOGIN_MATCH_THRESHOLD", 0.4),
  doorMatchThreshold: parseEnvFloat("FACE_DOOR_MATCH_THRESHOLD", 0.4),
  loginMinConfidencePercent: parseEnvInt("FACE_LOGIN_MIN_CONFIDENCE_PERCENT", 35),
  identityMinMargin: parseEnvFloat("FACE_IDENTITY_MIN_MARGIN", 0.1),
  minTemplateMatches: parseEnvInt("FACE_MIN_TEMPLATE_MATCHES", 2),
  enrollConflictMaxDistance: parseEnvFloat("FACE_ENROLL_CONFLICT_MAX_DISTANCE", 0.4),
  multiFrameRequiredMatches: parseEnvInt("FACE_MULTIFRAME_REQUIRED", 3),
  multiFrameTotal: parseEnvInt("FACE_MULTIFRAME_TOTAL", 5),
  enrollmentSamePersonMaxDistance: parseEnvFloat("FACE_ENROLL_SAME_PERSON_MAX", 0.42),
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
