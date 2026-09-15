/**
 * Liveness detection placeholder — not yet implemented with a trusted model.
 * Pipeline stages should call checkLiveness() and fail closed until a real check exists.
 */

export type LivenessStatus = "NOT_IMPLEMENTED" | "PASS" | "FAIL";

export type LivenessResult = {
  status: LivenessStatus;
  /** When NOT_IMPLEMENTED, callers may skip liveness gating (current production behavior). */
  enforced: boolean;
  reason?: string;
};

/** Returns NOT_IMPLEMENTED — wire a real liveness model here in a future phase. */
export function checkLiveness(_input?: {
  frameCount?: number;
  /** Client hint only — never trusted for auth */
  clientClaim?: boolean;
}): LivenessResult {
  return {
    status: "NOT_IMPLEMENTED",
    enforced: false,
    reason: "Liveness model not configured",
  };
}
