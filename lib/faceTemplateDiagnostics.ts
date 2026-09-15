import { euclideanDistance, FACE_DESCRIPTOR_LENGTH, parseFaceDescriptor } from "@/lib/faceMatch";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { prisma } from "@/lib/prisma";

export type FaceTemplateIssue =
  | "MISSING_TEMPLATES"
  | "INVALID_DIMENSION"
  | "NULL_OR_INVALID_VECTOR"
  | "DUPLICATE_TEMPLATE"
  | "INCONSISTENT_TEMPLATES"
  | "SINGLE_OLD_TEMPLATE"
  | "LOW_QUALITY_SCORE"
  | "WRONG_COMPANY_LINK"
  | "INACTIVE_EMPLOYEE";

export type EmployeeFaceDiagnostic = {
  employeeId: string;
  employeeName: string;
  companyId: string;
  templateCount: number;
  embeddingDimension: number | null;
  issues: FaceTemplateIssue[];
  reEnrollmentRequired: boolean;
  templateSpread: number | null;
  avgQualityScore: number | null;
};

export type CompanyFaceDiagnosticSummary = {
  companyId: string;
  policy: ReturnType<typeof resolveFaceIdentityPolicy>;
  employees: EmployeeFaceDiagnostic[];
  totalWithIssues: number;
};

function templateSpread(descriptors: number[][]): number | null {
  if (descriptors.length < 2) return null;
  let max = 0;
  for (let i = 0; i < descriptors.length; i++) {
    for (let j = i + 1; j < descriptors.length; j++) {
      const d = euclideanDistance(descriptors[i]!, descriptors[j]!);
      if (d > max) max = d;
    }
  }
  return max;
}

function findDuplicatePairs(descriptors: number[][]): boolean {
  for (let i = 0; i < descriptors.length; i++) {
    for (let j = i + 1; j < descriptors.length; j++) {
      if (euclideanDistance(descriptors[i]!, descriptors[j]!) < 0.05) return true;
    }
  }
  return false;
}

export async function diagnoseCompanyFaceTemplates(
  companyId: string
): Promise<CompanyFaceDiagnosticSummary> {
  const policy = resolveFaceIdentityPolicy();
  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      companyId: true,
      faceEnrolledAt: true,
      user: { select: { role: true } },
      faceCredentials: {
        select: { descriptor: true, qualityScore: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const rows: EmployeeFaceDiagnostic[] = [];

  for (const emp of employees) {
    const issues: FaceTemplateIssue[] = [];
    const creds = emp.faceCredentials;

    if (emp.faceEnrolledAt && creds.length === 0) {
      issues.push("MISSING_TEMPLATES");
    }

    const descriptors: number[][] = [];
    let invalidCount = 0;
    for (const c of creds) {
      const d = parseFaceDescriptor(c.descriptor);
      if (!d) {
        invalidCount += 1;
        continue;
      }
      if (d.length !== FACE_DESCRIPTOR_LENGTH) {
        issues.push("INVALID_DIMENSION");
      }
      descriptors.push(d);
    }

    if (invalidCount > 0) issues.push("NULL_OR_INVALID_VECTOR");

    if (descriptors.length === 0 && emp.faceEnrolledAt) {
      issues.push("NULL_OR_INVALID_VECTOR");
    }

    const spread = templateSpread(descriptors);
    const samePersonMax = policy.enrollmentSamePersonMaxDistance;
    if (spread != null && spread > samePersonMax + 0.12) {
      issues.push("INCONSISTENT_TEMPLATES");
    }

    if (findDuplicatePairs(descriptors)) {
      issues.push("DUPLICATE_TEMPLATE");
    }

    if (emp.faceEnrolledAt && descriptors.length === 1) {
      const ageMs = Date.now() - creds[0]!.createdAt.getTime();
      if (ageMs > 180 * 24 * 60 * 60 * 1000) {
        issues.push("SINGLE_OLD_TEMPLATE");
      }
    }

    const qualityScores = creds
      .map((c) => c.qualityScore)
      .filter((q): q is number => q != null && Number.isFinite(q));
    const avgQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : null;
    if (avgQuality != null && avgQuality < 0.28) {
      issues.push("LOW_QUALITY_SCORE");
    }

    if (emp.companyId !== companyId) {
      issues.push("WRONG_COMPANY_LINK");
    }

    const uniqueIssues = [...new Set(issues)];
    rows.push({
      employeeId: emp.id,
      employeeName: emp.name,
      companyId: emp.companyId,
      templateCount: descriptors.length,
      embeddingDimension: descriptors[0]?.length ?? null,
      issues: uniqueIssues,
      reEnrollmentRequired: uniqueIssues.length > 0,
      templateSpread: spread,
      avgQualityScore: avgQuality,
    });
  }

  return {
    companyId,
    policy,
    employees: rows,
    totalWithIssues: rows.filter((r) => r.reEnrollmentRequired).length,
  };
}
