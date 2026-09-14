import { euclideanDistance, FACE_MATCH_THRESHOLD, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";

/** 같은 회사에 이미 등록된 다른 직원 얼굴과 충돌하는지 */
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
    select: { id: true, faceDescriptor: true },
  });

  for (const other of others) {
    const stored = parseFaceDescriptor(other.faceDescriptor);
    if (!stored) continue;
    if (euclideanDistance(stored, probe) < FACE_MATCH_THRESHOLD) {
      return { id: other.id };
    }
  }
  return null;
}
