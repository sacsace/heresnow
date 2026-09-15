import {
  distanceToConfidencePercent,
  euclideanDistance,
  FACE_DESCRIPTOR_LENGTH,
  parseFaceDescriptor,
} from "@/lib/faceMatch";
import type { FaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { logFaceMatchDebug } from "@/lib/faceMatchDebug";

export type FaceIdentityRejectReason =
  | "INVALID_PROBE"
  | "NO_TEMPLATES"
  | "UNKNOWN"
  | "MATCH_THRESHOLD_FAILED"
  | "IDENTITY_MARGIN_FAILED"
  | "TEMPLATE_CONSISTENCY_FAILED"
  | "AMBIGUOUS"
  | "MULTIFRAME_FAILED"
  | "INCONSISTENT_FRAMES"
  | "LOW_CONFIDENCE";

export type TemplateMatchAnalysis = {
  bestDistance: number;
  distances: number[];
  matchCount: number;
  consistent: boolean;
};

export type EmployeeTemplateCandidate = {
  id: string;
  descriptors: number[][];
  /** Optional display name for debug */
  name?: string;
};

export type ScoredEmployee = {
  employeeId: string;
  name?: string;
  bestDistance: number;
  templateAnalysis: TemplateMatchAnalysis;
};

export type FaceIdentifyDebug = {
  detectedFaces?: number;
  detectionScore?: number;
  threshold: number;
  requiredMargin: number;
  minTemplateMatches: number;
  best?: { employeeId: string; name?: string; distance: number; templateDistances: number[]; matchCount: number };
  second?: { employeeId: string; name?: string; distance: number };
  identityMargin?: number;
  frameConfirmation?: { passed: number; total: number; required: number };
};

export type FaceIdentifyPass = {
  status: "PASS";
  employeeId: string;
  distance: number;
  confidencePercent: number;
  templateMatchCount: number;
  debug: FaceIdentifyDebug;
};

export type FaceIdentifyFail = {
  status: "UNKNOWN" | "AMBIGUOUS";
  reason: FaceIdentityRejectReason;
  debug: FaceIdentifyDebug;
};

export type FaceIdentifyResult = FaceIdentifyPass | FaceIdentifyFail;

/** Per-employee: all templates vs probe — consistency required */
export function analyzeTemplateMatch(
  descriptors: number[][],
  probe: number[],
  threshold: number,
  minTemplateMatches: number
): TemplateMatchAnalysis {
  const distances: number[] = [];
  for (const stored of descriptors) {
    if (stored.length !== probe.length) continue;
    distances.push(euclideanDistance(stored, probe));
  }
  if (distances.length === 0) {
    return { bestDistance: Number.POSITIVE_INFINITY, distances: [], matchCount: 0, consistent: false };
  }
  distances.sort((a, b) => a - b);
  const bestDistance = distances[0]!;
  const matchCount = distances.filter((d) => d < threshold).length;
  const consistent =
    bestDistance < threshold && matchCount >= Math.min(minTemplateMatches, distances.length);
  return { bestDistance, distances, matchCount, consistent };
}

/** Score all employees — only those with template consistency participate in 1:N ranking */
export function scoreEmployeeCandidates(
  candidates: EmployeeTemplateCandidate[],
  probe: number[],
  policy: FaceIdentityPolicy
): ScoredEmployee[] {
  const scored: ScoredEmployee[] = [];
  for (const c of candidates) {
    const parsed = c.descriptors
      .map((d) => (Array.isArray(d) ? d : parseFaceDescriptor(d)))
      .filter((d): d is number[] => d != null && d.length > 0);
    if (parsed.length === 0) continue;
    const analysis = analyzeTemplateMatch(
      parsed,
      probe,
      policy.matchThreshold,
      policy.minTemplateMatches
    );
    if (!analysis.consistent) continue;
    scored.push({
      employeeId: c.id,
      name: c.name,
      bestDistance: analysis.bestDistance,
      templateAnalysis: analysis,
    });
  }
  scored.sort((a, b) => a.bestDistance - b.bestDistance);
  return scored;
}

/**
 * 1:N identity — default UNKNOWN; PASS only if threshold + margin + template consistency.
 * Never: closest employee wins without checks.
 */
export function identifyEmployeeAmongCandidates(
  candidates: EmployeeTemplateCandidate[],
  probe: number[],
  policy: FaceIdentityPolicy,
  context?: {
    purpose?: "login" | "door" | "generic";
    thresholdOverride?: number;
    minConfidencePercent?: number;
  }
): FaceIdentifyResult {
  const threshold = context?.thresholdOverride ?? policy.matchThreshold;

  if (
    probe.length !== FACE_DESCRIPTOR_LENGTH ||
    probe.some((n) => !Number.isFinite(n))
  ) {
    return {
      status: "UNKNOWN",
      reason: "INVALID_PROBE",
      debug: {
        threshold,
        requiredMargin: policy.identityMinMargin,
        minTemplateMatches: policy.minTemplateMatches,
      },
    };
  }

  if (candidates.length === 0) {
    return {
      status: "UNKNOWN",
      reason: "NO_TEMPLATES",
      debug: {
        threshold,
        requiredMargin: policy.identityMinMargin,
        minTemplateMatches: policy.minTemplateMatches,
      },
    };
  }

  const scored: ScoredEmployee[] = [];
  for (const c of candidates) {
    const parsed = c.descriptors
      .map((d) => (Array.isArray(d) ? d : parseFaceDescriptor(d)))
      .filter((d): d is number[] => d != null && d.length > 0);
    if (parsed.length === 0) continue;
    const analysis = analyzeTemplateMatch(
      parsed,
      probe,
      threshold,
      policy.minTemplateMatches
    );
    if (!analysis.consistent) continue;
    scored.push({
      employeeId: c.id,
      name: c.name,
      bestDistance: analysis.bestDistance,
      templateAnalysis: analysis,
    });
  }

  scored.sort((a, b) => a.bestDistance - b.bestDistance);

  const debug: FaceIdentifyDebug = {
    threshold,
    requiredMargin: policy.identityMinMargin,
    minTemplateMatches: policy.minTemplateMatches,
  };

  if (scored.length === 0) {
    debug.best = undefined;
    const fail: FaceIdentifyFail = {
      status: "UNKNOWN",
      reason: "TEMPLATE_CONSISTENCY_FAILED",
      debug,
    };
    logFaceMatchDebug(context?.purpose ?? "generic", fail);
    return fail;
  }

  const best = scored[0]!;
  debug.best = {
    employeeId: best.employeeId,
    name: best.name,
    distance: best.bestDistance,
    templateDistances: best.templateAnalysis.distances,
    matchCount: best.templateAnalysis.matchCount,
  };

  if (best.bestDistance >= threshold) {
    const fail: FaceIdentifyFail = {
      status: "UNKNOWN",
      reason: "MATCH_THRESHOLD_FAILED",
      debug,
    };
    logFaceMatchDebug(context?.purpose ?? "generic", fail);
    return fail;
  }

  if (scored.length >= 2) {
    const second = scored[1]!;
    debug.second = {
      employeeId: second.employeeId,
      name: second.name,
      distance: second.bestDistance,
    };
    const margin = second.bestDistance - best.bestDistance;
    debug.identityMargin = margin;
    if (margin < policy.identityMinMargin) {
      const fail: FaceIdentifyFail = {
        status: "AMBIGUOUS",
        reason: "IDENTITY_MARGIN_FAILED",
        debug,
      };
      logFaceMatchDebug(context?.purpose ?? "generic", fail);
      return fail;
    }
  }

  const confidencePercent = distanceToConfidencePercent(best.bestDistance, threshold);
  const minConfidence = context?.minConfidencePercent;
  if (minConfidence != null && confidencePercent < minConfidence) {
    const fail: FaceIdentifyFail = {
      status: "UNKNOWN",
      reason: "LOW_CONFIDENCE",
      debug,
    };
    logFaceMatchDebug(context?.purpose ?? "generic", fail);
    return fail;
  }

  const pass: FaceIdentifyPass = {
    status: "PASS",
    employeeId: best.employeeId,
    distance: best.bestDistance,
    confidencePercent,
    templateMatchCount: best.templateAnalysis.matchCount,
    debug,
  };
  logFaceMatchDebug(context?.purpose ?? "generic", pass);
  return pass;
}

export type FaceVerify1Result = {
  matched: boolean;
  distance: number;
  confidencePercent: number;
  credentialId: string | null;
  templateMatchCount: number;
  reason?: FaceIdentityRejectReason;
  templateDistances: number[];
};

/** 1:1 verify — session-bound employee; template consistency required */
export function verifyEmployeeTemplates(
  credentials: Array<{ id: string; descriptor: unknown }>,
  probe: number[],
  policy: FaceIdentityPolicy,
  thresholdOverride?: number
): FaceVerify1Result {
  const threshold = thresholdOverride ?? policy.matchThreshold;
  const descriptors: { id: string; vec: number[] }[] = [];
  for (const cred of credentials) {
    const stored = parseFaceDescriptor(cred.descriptor);
    if (stored) descriptors.push({ id: cred.id, vec: stored });
  }

  if (descriptors.length === 0) {
    return {
      matched: false,
      distance: Number.POSITIVE_INFINITY,
      confidencePercent: 0,
      credentialId: null,
      templateMatchCount: 0,
      reason: "NO_TEMPLATES",
      templateDistances: [],
    };
  }

  const vecs = descriptors.map((d) => d.vec);
  const analysis = analyzeTemplateMatch(vecs, probe, threshold, policy.minTemplateMatches);
  const bestIdx = analysis.distances.length
    ? vecs.findIndex((v) => euclideanDistance(v, probe) === analysis.bestDistance)
    : -1;
  const bestId = bestIdx >= 0 ? descriptors[bestIdx]!.id : null;

  const matched = analysis.consistent && analysis.bestDistance < threshold;

  const result: FaceVerify1Result = {
    matched,
    distance: analysis.bestDistance,
    confidencePercent: distanceToConfidencePercent(analysis.bestDistance, threshold),
    credentialId: bestId,
    templateMatchCount: analysis.matchCount,
    templateDistances: analysis.distances,
    reason: matched
      ? undefined
      : analysis.bestDistance >= threshold
        ? "MATCH_THRESHOLD_FAILED"
        : "TEMPLATE_CONSISTENCY_FAILED",
  };

  logFaceMatchDebug("verify1", matched ? { status: "PASS", ...result } : { status: "UNKNOWN", ...result });
  return result;
}

export type MultiFrameIdentifyResult =
  | { status: "PASS"; employeeId: string; framePassCount: number; frameTotal: number }
  | { status: "UNKNOWN" | "AMBIGUOUS"; reason: FaceIdentityRejectReason; framePassCount: number; frameTotal: number };

/** Multi-frame — probes must be distinct; same employee must win on enough frames */
export function confirmMultiFrameIdentity(
  probes: number[][],
  candidates: EmployeeTemplateCandidate[],
  policy: FaceIdentityPolicy,
  context?: {
    purpose?: "door" | "login";
    thresholdOverride?: number;
    minConfidencePercent?: number;
  }
): MultiFrameIdentifyResult {
  const required = policy.multiFrameRequiredMatches;
  const total = probes.length;

  if (total < required) {
    return {
      status: "UNKNOWN",
      reason: "MULTIFRAME_FAILED",
      framePassCount: 0,
      frameTotal: total,
    };
  }

  const frameWinners: string[] = [];
  for (const probe of probes) {
    const r = identifyEmployeeAmongCandidates(candidates, probe, policy, context);
    if (r.status === "PASS") frameWinners.push(r.employeeId);
  }

  if (frameWinners.length < required) {
    return {
      status: "UNKNOWN",
      reason: "MULTIFRAME_FAILED",
      framePassCount: frameWinners.length,
      frameTotal: total,
    };
  }

  const counts = new Map<string, number>();
  for (const id of frameWinners) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let topId = "";
  let topCount = 0;
  for (const [id, c] of counts) {
    if (c > topCount) {
      topId = id;
      topCount = c;
    }
  }

  if (topCount < required) {
    return {
      status: "AMBIGUOUS",
      reason: "INCONSISTENT_FRAMES",
      framePassCount: topCount,
      frameTotal: total,
    };
  }

  const secondCount = [...counts.values()].sort((a, b) => b - a)[1] ?? 0;
  if (secondCount > 0 && topCount - secondCount < 2 && topCount < total) {
    return {
      status: "AMBIGUOUS",
      reason: "INCONSISTENT_FRAMES",
      framePassCount: topCount,
      frameTotal: total,
    };
  }

  return {
    status: "PASS",
    employeeId: topId,
    framePassCount: topCount,
    frameTotal: total,
  };
}
