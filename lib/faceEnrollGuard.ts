import { euclideanDistance, parseFaceDescriptor } from "@/lib/faceMatch";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { prisma } from "@/lib/prisma";

/** 같은 회사에 이미 등록된 다른 직원 얼굴과 충돌하는지 (다중 credential 포함) */
export async function findConflictingFaceEmployee(
  companyId: string,
  employeeId: string,
  probe: number[]
): Promise<{ id: string } | null> {
  const others = await prisma.employee.findMany({
    where: {
      companyId,
      faceEnrolledAt: { not: null },
      id: { not: employeeId },
    },
    select: {
      id: true,
      faceCredentials: { select: { descriptor: true } },
    },
  });

  for (const other of others) {
    for (const cred of other.faceCredentials) {
      const stored = parseFaceDescriptor(cred.descriptor);
      if (!stored) continue;
      const conflictMax = resolveFaceIdentityPolicy().enrollConflictMaxDistance;
      if (euclideanDistance(stored, probe) < conflictMax) {
        return { id: other.id };
      }
    }
  }
  return null;
}
