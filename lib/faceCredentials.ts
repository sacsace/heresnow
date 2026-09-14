import {
  distanceToConfidencePercent,
  euclideanDistance,
  FACE_MATCH_THRESHOLD,
  parseFaceDescriptor,
} from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type FaceCredentialRow = {
  id: string;
  descriptor: unknown;
  previewUrl?: string | null;
};

export type FaceMatchResult = {
  matched: boolean;
  distance: number;
  confidencePercent: number;
  credentialId: string | null;
};

/** 직원 credential 중 probe와 가장 가까운 매칭 */
export function matchFaceCredentials(
  credentials: FaceCredentialRow[],
  probe: number[],
  threshold = FACE_MATCH_THRESHOLD
): FaceMatchResult {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const cred of credentials) {
    const stored = parseFaceDescriptor(cred.descriptor);
    if (!stored) continue;
    const distance = euclideanDistance(stored, probe);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = cred.id;
    }
  }

  if (bestId == null) {
    return { matched: false, distance: Number.POSITIVE_INFINITY, confidencePercent: 0, credentialId: null };
  }

  return {
    matched: bestDistance < threshold,
    distance: bestDistance,
    confidencePercent: distanceToConfidencePercent(bestDistance, threshold),
    credentialId: bestId,
  };
}

/** Employee.faceDescriptor 등 레거시 필드를 credential 테이블과 동기화 */
export async function syncEmployeeFaceFields(employeeId: string): Promise<void> {
  const creds = await prisma.employeeFaceCredential.findMany({
    where: { employeeId },
    orderBy: { createdAt: "asc" },
  });

  if (creds.length === 0) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        faceDescriptor: Prisma.DbNull,
        faceEnrolledAt: null,
        facePreviewUrl: null,
      },
    });
    return;
  }

  const latest = creds[creds.length - 1]!;
  const preview = [...creds].reverse().find((c) => c.previewUrl)?.previewUrl ?? null;
  const descriptor = parseFaceDescriptor(latest.descriptor);

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      faceDescriptor: descriptor ?? Prisma.DbNull,
      faceEnrolledAt: creds[0]!.createdAt,
      facePreviewUrl: preview,
    },
  });
}

export async function loadEmployeeFaceCredentials(employeeId: string): Promise<FaceCredentialRow[]> {
  return prisma.employeeFaceCredential.findMany({
    where: { employeeId },
    select: { id: true, descriptor: true, previewUrl: true },
    orderBy: { createdAt: "asc" },
  });
}
