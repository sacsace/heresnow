import { distanceToConfidencePercent, parseFaceDescriptor } from "@/lib/faceMatch";
import { verifyEmployeeTemplates } from "@/lib/faceIdentityMatch";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
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
  templateMatchCount?: number;
  reason?: string;
};

/** 직원 credential — template consistency + absolute threshold (1:1) */
export function matchFaceCredentials(
  credentials: FaceCredentialRow[],
  probe: number[],
  threshold?: number
): FaceMatchResult {
  const policy = resolveFaceIdentityPolicy();
  const result = verifyEmployeeTemplates(
    credentials,
    probe,
    policy,
    threshold ?? policy.matchThreshold
  );
  return {
    matched: result.matched,
    distance: result.distance,
    confidencePercent: result.confidencePercent,
    credentialId: result.credentialId,
    templateMatchCount: result.templateMatchCount,
    reason: result.reason,
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
