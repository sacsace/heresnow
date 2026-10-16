import { euclideanDistance, parseFaceDescriptor } from "@/lib/faceMatch";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { prisma } from "@/lib/prisma";

export type FaceEnrollConflict = {
  id: string;
  name: string;
  bestDistance: number;
  templateHits: number;
};

/**
 * 같은 회사 다른 직원 얼굴과 충돌하는지.
 * - hard: 한 템플릿이라도 hardMax 미만 → 충돌 (거의 동일)
 * - soft: softMax 미만 템플릿이 minHits개 이상 → 충돌 (오탐 완화)
 */
export async function findConflictingFaceEmployee(
  companyId: string,
  employeeId: string,
  probe: number[]
): Promise<FaceEnrollConflict | null> {
  const policy = resolveFaceIdentityPolicy();
  const softMax = policy.enrollConflictMaxDistance;
  const hardMax = policy.enrollConflictHardMaxDistance;
  const minHits = policy.enrollConflictMinTemplateHits;

  const others = await prisma.employee.findMany({
    where: {
      companyId,
      faceEnrolledAt: { not: null },
      id: { not: employeeId },
    },
    select: {
      id: true,
      name: true,
      faceCredentials: { select: { descriptor: true } },
    },
  });

  let best: FaceEnrollConflict | null = null;

  for (const other of others) {
    let bestDistance = Number.POSITIVE_INFINITY;
    let softHits = 0;

    for (const cred of other.faceCredentials) {
      const stored = parseFaceDescriptor(cred.descriptor);
      if (!stored) continue;
      const d = euclideanDistance(stored, probe);
      if (d < bestDistance) bestDistance = d;
      if (d < softMax) softHits += 1;
    }

    if (!Number.isFinite(bestDistance)) continue;

    const isHard = bestDistance < hardMax;
    const isSoft = softHits >= minHits;
    if (!isHard && !isSoft) continue;

    if (!best || bestDistance < best.bestDistance) {
      best = {
        id: other.id,
        name: other.name,
        bestDistance,
        templateHits: softHits,
      };
    }
  }

  return best;
}

/** 배치 샘플 중 같은 직원과의 충돌이 충분한지 (단발 오탐 완화) */
export async function findConflictingFaceEmployeeForSamples(
  companyId: string,
  employeeId: string,
  probes: number[][]
): Promise<FaceEnrollConflict | null> {
  if (probes.length === 0) return null;

  const hitsByEmployee = new Map<string, FaceEnrollConflict & { sampleHits: number }>();

  for (const probe of probes) {
    const conflict = await findConflictingFaceEmployee(companyId, employeeId, probe);
    if (!conflict) continue;
    const prev = hitsByEmployee.get(conflict.id);
    if (!prev) {
      hitsByEmployee.set(conflict.id, { ...conflict, sampleHits: 1 });
    } else {
      prev.sampleHits += 1;
      if (conflict.bestDistance < prev.bestDistance) {
        prev.bestDistance = conflict.bestDistance;
        prev.templateHits = conflict.templateHits;
      }
    }
  }

  let best: (FaceEnrollConflict & { sampleHits: number }) | null = null;
  for (const row of hitsByEmployee.values()) {
    const hard = row.bestDistance < resolveFaceIdentityPolicy().enrollConflictHardMaxDistance;
    // 하드 충돌 1회 또는 샘플 과반(최소 2)이 같은 직원과 충돌
    const softBatch = row.sampleHits >= Math.max(2, Math.ceil(probes.length / 2));
    if (!hard && !softBatch) continue;
    if (!best || row.bestDistance < best.bestDistance) best = row;
  }

  if (!best) return null;
  const { sampleHits: _, ...conflict } = best;
  return conflict;
}
