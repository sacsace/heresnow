import type { Role } from "@prisma/client";
import {
  euclideanDistance,
  FACE_IDENTIFY_MIN_GAP_LOGIN,
  FACE_MATCH_THRESHOLD_LOGIN,
  FACE_MATCH_THRESHOLD_LOGIN_CONFIDENT,
  parseFaceDescriptor,
} from "@/lib/faceMatch";
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

export type FaceLoginPickFailure = {
  reason: "no_enrolled" | "no_match" | "ambiguous";
  bestDistance?: number;
  secondDistance?: number;
};

type ScoredCandidate = {
  employeeId: string;
  distance: number;
};

/** 1:N — 전 후보 거리 비교 */
export function pickFaceLoginMatch(
  employees: Array<{ id: string; faceDescriptor: unknown }>,
  probe: number[]
): { employeeId: string } | FaceLoginPickFailure {
  const scored: ScoredCandidate[] = [];

  for (const emp of employees) {
    const stored = parseFaceDescriptor(emp.faceDescriptor);
    if (!stored) continue;
    scored.push({ employeeId: emp.id, distance: euclideanDistance(stored, probe) });
  }

  if (scored.length === 0) {
    return { reason: employees.length === 0 ? "no_enrolled" : "no_match" };
  }

  scored.sort((a, b) => a.distance - b.distance);
  const best = scored[0]!;

  if (best.distance >= FACE_MATCH_THRESHOLD_LOGIN) {
    return { reason: "no_match", bestDistance: best.distance };
  }

  if (scored.length > 1) {
    const second = scored[1]!;
    const gap = second.distance - best.distance;
    const confident = best.distance <= FACE_MATCH_THRESHOLD_LOGIN_CONFIDENT;
    const clearWinner = gap >= FACE_IDENTIFY_MIN_GAP_LOGIN;
    const ratioWinner = gap / Math.max(best.distance, 0.01) >= 0.1;
    if (!confident && !clearWinner && !ratioWinner) {
      return {
        reason: "ambiguous",
        bestDistance: best.distance,
        secondDistance: second.distance,
      };
    }
  }

  return { employeeId: best.employeeId };
}

/** 로그인 1:N — 해당 회사 직원만 검색 */
export async function matchFaceLoginUser(
  probe: number[],
  companyId: string
): Promise<{ user: FaceLoginUser } | FaceLoginPickFailure> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      faceEnrolledAt: { not: null },
      company: { faceRecognitionEnabled: true },
      user: { role: { notIn: ["DOOR", "SUPER_ADMIN"] } },
    },
    select: {
      id: true,
      faceDescriptor: true,
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

  const picked = pickFaceLoginMatch(employees, probe);
  if ("reason" in picked) return picked;

  const emp = employees.find((e) => e.id === picked.employeeId);
  if (!emp) return { reason: "no_match" };

  return {
    user: {
      id: emp.user.id,
      email: emp.user.email,
      role: emp.user.role as Role,
      companyId: emp.user.companyId,
      employeeId: emp.id,
    },
  };
}
