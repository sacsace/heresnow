import type { Role } from "@prisma/client";
import {
  confirmMultiFrameIdentity,
  identifyEmployeeAmongCandidates,
  type FaceIdentifyFail,
} from "@/lib/faceIdentityMatch";
import { matchFaceCredentials } from "@/lib/faceCredentials";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { dedupeFaceProbes } from "@/lib/faceProbeDedupe";
import { averageFaceDescriptors, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";

export function parseProbeDescriptor(raw: unknown): number[] | null {
  if (typeof raw === "string") {
    try {
      return parseFaceDescriptor(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    return parseFaceDescriptor(raw);
  }
  return null;
}

export type FaceLoginUser = {
  id: string;
  email: string;
  role: Role;
  companyId: string | null;
  employeeId: string;
};

export type FaceLoginApiError = "no_enrolled" | "no_match" | "ambiguous";

export type FaceLoginPickFailure = {
  reason: FaceLoginApiError;
  bestDistance?: number;
  secondDistance?: number;
  confidencePercent?: number;
  detail?: FaceIdentifyFail["reason"];
};

type LoginCandidate = {
  id: string;
  descriptors: number[][];
  user: {
    id: string;
    email: string;
    role: Role;
    companyId: string | null;
  };
};

async function loadFaceLoginCandidates(companyId: string): Promise<LoginCandidate[]> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      faceEnrolledAt: { not: null },
      company: { faceRecognitionEnabled: true },
      user: { role: { notIn: ["DOOR", "SUPER_ADMIN"] } },
    },
    select: {
      id: true,
      faceCredentials: { select: { id: true, descriptor: true } },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
        },
      },
    },
  });

  return employees
    .map((emp) => ({
      id: emp.id,
      descriptors: emp.faceCredentials
        .map((c) => parseFaceDescriptor(c.descriptor))
        .filter((d): d is number[] => d != null),
      user: {
        id: emp.user.id,
        email: emp.user.email,
        role: emp.user.role as Role,
        companyId: emp.user.companyId,
      },
    }))
    .filter((e) => e.descriptors.length > 0);
}

function toLoginUser(candidate: LoginCandidate): FaceLoginUser {
  return {
    id: candidate.user.id,
    email: candidate.user.email,
    role: candidate.user.role,
    companyId: candidate.user.companyId,
    employeeId: candidate.id,
  };
}

function mapLoginFailure(
  result: FaceIdentifyFail,
  confidencePercent?: number
): FaceLoginPickFailure {
  const apiReason: FaceLoginApiError =
    result.status === "AMBIGUOUS" ||
    result.reason === "IDENTITY_MARGIN_FAILED" ||
    result.reason === "INCONSISTENT_FRAMES"
      ? "ambiguous"
      : "no_match";
  return {
    reason: apiReason,
    bestDistance: result.debug.best?.distance,
    secondDistance: result.debug.second?.distance,
    confidencePercent,
    detail: result.reason,
  };
}

/** Final 1:1 check — identical to PUT /api/employee/face (account 「인식 테스트」) */
function verifyLoginEmployee1to1(
  credentials: Array<{ id: string; descriptor: unknown }>,
  probe: number[]
): { ok: true; confidencePercent: number } | { ok: false; detail: FaceIdentifyFail["reason"] } {
  const verify = matchFaceCredentials(credentials, probe);
  if (!verify.matched) {
    const detail = (verify.reason ?? "MATCH_THRESHOLD_FAILED") as FaceIdentifyFail["reason"];
    return { ok: false, detail };
  }
  return { ok: true, confidencePercent: verify.confidencePercent };
}

/** 로그인 1:N — single frame (legacy); still enforces confidence + 1:1 */
export async function matchFaceLoginUser(
  probe: number[],
  companyId: string
): Promise<{ user: FaceLoginUser; confidencePercent: number } | FaceLoginPickFailure> {
  const policy = resolveFaceIdentityPolicy();
  const loaded = await loadFaceLoginCandidates(companyId);

  if (loaded.length === 0) {
    return { reason: "no_enrolled" };
  }

  const candidates = loaded.map((e) => ({
    id: e.id,
    descriptors: e.descriptors,
  }));

  const result = identifyEmployeeAmongCandidates(candidates, probe, policy, {
    purpose: "login",
    thresholdOverride: policy.matchThreshold,
  });

  if (result.status !== "PASS") {
    return mapLoginFailure(result);
  }

  const matched = loaded.find((e) => e.id === result.employeeId);
  if (!matched) {
    return { reason: "no_match", bestDistance: result.distance };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: matched.id, companyId },
    select: { faceCredentials: { select: { id: true, descriptor: true } } },
  });
  if (!employee) {
    return { reason: "no_match", bestDistance: result.distance };
  }

  const verify = verifyLoginEmployee1to1(employee.faceCredentials, probe);
  if (!verify.ok) {
    return {
      reason: "no_match",
      bestDistance: result.distance,
      confidencePercent: result.confidencePercent,
      detail: verify.detail,
    };
  }

  return { user: toLoginUser(matched), confidencePercent: verify.confidencePercent };
}

/** 로그인 — multi-frame + 1:1 averaged probe verification (required for public login) */
export async function matchFaceLoginUserMultiFrame(
  probes: number[][],
  companyId: string
): Promise<{ user: FaceLoginUser; confidencePercent: number } | FaceLoginPickFailure> {
  const policy = resolveFaceIdentityPolicy();
  const unique = dedupeFaceProbes(probes);
  if (unique.length < policy.multiFrameRequiredMatches) {
    return { reason: "no_match", detail: "MULTIFRAME_FAILED" };
  }

  const loaded = await loadFaceLoginCandidates(companyId);
  if (loaded.length === 0) {
    return { reason: "no_enrolled" };
  }

  const candidates = loaded.map((e) => ({
    id: e.id,
    descriptors: e.descriptors,
  }));

  const mf = confirmMultiFrameIdentity(unique, candidates, policy, {
    purpose: "login",
    thresholdOverride: policy.loginMatchThreshold,
    minConfidencePercent: policy.loginMinConfidencePercent,
  });

  if (mf.status !== "PASS") {
    return {
      reason: mf.status === "AMBIGUOUS" ? "ambiguous" : "no_match",
      detail: mf.reason,
      confidencePercent: 0,
    };
  }

  const matched = loaded.find((e) => e.id === mf.employeeId);
  if (!matched) {
    return { reason: "no_match", detail: "UNKNOWN" };
  }

  const averaged = averageFaceDescriptors(unique);
  if (!averaged) {
    return { reason: "no_match", detail: "INVALID_PROBE" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: matched.id, companyId },
    select: { faceCredentials: { select: { id: true, descriptor: true } } },
  });
  if (!employee) {
    return { reason: "no_match", detail: "UNKNOWN" };
  }

  const verify = verifyLoginEmployee1to1(employee.faceCredentials, averaged);
  if (!verify.ok) {
    return {
      reason: "no_match",
      confidencePercent: 0,
      detail: verify.detail,
    };
  }

  return { user: toLoginUser(matched), confidencePercent: verify.confidencePercent };
}
