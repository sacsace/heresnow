export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { seatLoginForbiddenResponse } from "@/lib/requireSeatLogin";
import {
  findConflictingFaceEmployee,
  findConflictingFaceEmployeeForSamples,
} from "@/lib/faceEnrollGuard";
import {
  loadEmployeeFaceCredentials,
  syncEmployeeFaceFields,
} from "@/lib/faceCredentials";
import {
  countFaceEnrollmentGroups,
  MAX_FACE_ENROLLMENTS,
} from "@/lib/faceEnrollmentGroups";
import {
  validateEnrollmentBatch,
  type EnrollmentPoseType,
  type EnrollmentSample,
} from "@/lib/faceEnrollment";
import { attachDescriptorV2ToCredentials, matchFaceHybrid } from "@/lib/faceMatchHybrid";
import { FACE_DESCRIPTOR_LENGTH, parseFaceDescriptor } from "@/lib/faceMatch";
import { isValidFacePreviewUrl } from "@/lib/facePreviewValidation";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const poseTypeSchema = z.enum([
  "FRONT",
  "LEFT_SLIGHT",
  "RIGHT_SLIGHT",
  "UP_OR_VARIATION",
  "FRONT_VARIATION",
]);

const sampleSchema = z.object({
  descriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH),
  poseType: poseTypeSchema,
  qualityScore: z.number().min(0).max(1),
});

const singleEnrollSchema = z.object({
  descriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH),
  previewUrl: z.string().max(1_000_000).optional(),
  /** COMPANY_ADMIN / HR_MANAGER / SUPER_ADMIN 만 — 충돌 무시 등록 */
  forceDespiteConflict: z.boolean().optional(),
});

const batchEnrollSchema = z.object({
  samples: z.array(sampleSchema).min(3).max(10),
  previewUrl: z.string().max(1_000_000).optional(),
  forceDespiteConflict: z.boolean().optional(),
});

const enrollBodySchema = z.union([singleEnrollSchema, batchEnrollSchema]);

function canForceFaceEnrollDespiteConflict(role: string | null | undefined): boolean {
  return role === "COMPANY_ADMIN" || role === "HR_MANAGER" || role === "SUPER_ADMIN";
}

function conflictResponse(
  conflict: { name: string },
  canForce: boolean
) {
  return NextResponse.json(
    {
      error: "FACE_CONFLICT_OTHER_EMPLOYEE",
      conflictEmployeeName: conflict.name,
      canForce,
    },
    { status: 409 }
  );
}

const deleteSchema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ batchId: z.string().min(1) }),
]);

export async function GET() {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emp = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
    select: {
      faceEnrolledAt: true,
      punchWithoutFace: true,
      company: { select: { faceRecognitionEnabled: true } },
      faceCredentials: {
        select: {
          id: true,
          previewUrl: true,
          createdAt: true,
          lastUsedAt: true,
          poseType: true,
          enrollmentBatchId: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!emp) {
    return NextResponse.json({ error: "직원 정보가 없습니다." }, { status: 403 });
  }

  const credentialItems = emp.faceCredentials.map((c) => ({
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
    hasPreview: c.previewUrl != null,
    batchId: c.enrollmentBatchId,
  }));

  return NextResponse.json({
    enrolled: emp.faceEnrolledAt != null,
    enrolledAt: emp.faceEnrolledAt?.toISOString() ?? null,
    hasPreview: emp.faceCredentials.some((c) => c.previewUrl != null),
    faceRecognitionEnabled:
      emp.company.faceRecognitionEnabled && !emp.punchWithoutFace,
    enrollmentCount: countFaceEnrollmentGroups(credentialItems),
    maxEnrollments: MAX_FACE_ENROLLMENTS,
    credentials: emp.faceCredentials.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      hasPreview: c.previewUrl != null,
      poseType: c.poseType,
      batchId: c.enrollmentBatchId,
    })),
  });
}

async function assertFaceRecognitionEnabled(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { faceRecognitionEnabled: true },
  });
  if (!company?.faceRecognitionEnabled) {
    return NextResponse.json(
      { error: "이 회사는 안면 인식 출근을 사용하지 않습니다." },
      { status: 403 }
    );
  }
  return null;
}

function parseEnrollmentSamples(
  raw: z.infer<typeof batchEnrollSchema>["samples"]
): EnrollmentSample[] | null {
  const parsed: EnrollmentSample[] = [];
  for (const s of raw) {
    const descriptor = parseFaceDescriptor(s.descriptor);
    if (!descriptor) return null;
    parsed.push({
      descriptor,
      poseType: s.poseType as EnrollmentPoseType,
      qualityScore: s.qualityScore,
      yaw: 0,
      pitch: 0,
    });
  }
  return parsed;
}

export async function POST(req: Request) {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const disabled = await assertFaceRecognitionEnabled(session.user.companyId);
  if (disabled) return disabled;

  const existingCredentials = await prisma.employeeFaceCredential.findMany({
    where: { employeeId: session.user.employeeId },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      previewUrl: true,
      enrollmentBatchId: true,
    },
  });
  const enrollmentCount = countFaceEnrollmentGroups(
    existingCredentials.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      hasPreview: c.previewUrl != null,
      batchId: c.enrollmentBatchId,
    }))
  );
  if (enrollmentCount >= MAX_FACE_ENROLLMENTS) {
    return NextResponse.json(
      { error: "FACE_ENROLLMENT_LIMIT", maxEnrollments: MAX_FACE_ENROLLMENTS },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = enrollBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "유효한 안면 데이터가 필요합니다." }, { status: 400 });
  }

  const previewUrl =
    "previewUrl" in parsed.data ? parsed.data.previewUrl : undefined;
  if (previewUrl != null && !isValidFacePreviewUrl(previewUrl)) {
    return NextResponse.json({ error: "유효한 얼굴 미리보기가 필요합니다." }, { status: 400 });
  }

  if ("samples" in parsed.data) {
    const samples = parseEnrollmentSamples(parsed.data.samples);
    if (!samples) {
      return NextResponse.json({ error: "유효한 안면 데이터가 필요합니다." }, { status: 400 });
    }

    const batchError = validateEnrollmentBatch(samples);
    if (batchError) {
      return NextResponse.json({ error: batchError }, { status: 400 });
    }

    const canForce = canForceFaceEnrollDespiteConflict(session.user.role);
    const force = Boolean(parsed.data.forceDespiteConflict) && canForce;
    if (!force) {
      const conflict = await findConflictingFaceEmployeeForSamples(
        session.user.companyId,
        session.user.employeeId,
        samples.map((s) => s.descriptor)
      );
      if (conflict) {
        return conflictResponse(conflict, canForce);
      }
    }

    const batchId = randomUUID();
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]!;
        const row = await tx.employeeFaceCredential.create({
          data: {
            employeeId: session.user.employeeId!,
            descriptor: sample.descriptor,
            poseType: sample.poseType,
            qualityScore: sample.qualityScore,
            enrollmentBatchId: batchId,
            ...(i === 0 && previewUrl != null ? { previewUrl } : {}),
          },
          select: { id: true, createdAt: true, poseType: true },
        });
        rows.push(row);
      }
      return rows;
    });

    await syncEmployeeFaceFields(session.user.employeeId);
    const v2 = await attachDescriptorV2ToCredentials(
      created.map((c) => c.id),
      previewUrl
    );

    return NextResponse.json({
      ok: true,
      enrolled: true,
      batchId,
      embedV2: v2.ok,
      credentials: created.map((c) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        poseType: c.poseType,
      })),
    });
  }

  const descriptor = parseFaceDescriptor(parsed.data.descriptor);
  if (!descriptor) {
    return NextResponse.json({ error: "유효한 안면 데이터가 필요합니다." }, { status: 400 });
  }

  const canForce = canForceFaceEnrollDespiteConflict(session.user.role);
  const force = Boolean(parsed.data.forceDespiteConflict) && canForce;
  if (!force) {
    const conflict = await findConflictingFaceEmployee(
      session.user.companyId,
      session.user.employeeId,
      descriptor
    );
    if (conflict) {
      return conflictResponse(conflict, canForce);
    }
  }

  const created = await prisma.employeeFaceCredential.create({
    data: {
      employeeId: session.user.employeeId,
      descriptor,
      poseType: "FRONT",
      ...(previewUrl != null ? { previewUrl } : {}),
    },
    select: { id: true, createdAt: true },
  });

  await syncEmployeeFaceFields(session.user.employeeId);
  const v2 = await attachDescriptorV2ToCredentials([created.id], previewUrl);

  return NextResponse.json({
    ok: true,
    enrolled: true,
    embedV2: v2.ok,
    credential: {
      id: created.id,
      createdAt: created.createdAt.toISOString(),
      hasPreview: previewUrl != null,
    },
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const disabled = await assertFaceRecognitionEnabled(session.user.companyId);
  if (disabled) return disabled;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if ("batchId" in parsed.data) {
    const deleted = await prisma.employeeFaceCredential.deleteMany({
      where: {
        employeeId: session.user.employeeId,
        enrollmentBatchId: parsed.data.batchId,
      },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "등록된 안면을 찾을 수 없습니다." }, { status: 404 });
    }
  } else {
    const cred = await prisma.employeeFaceCredential.findFirst({
      where: { id: parsed.data.id, employeeId: session.user.employeeId },
      select: { id: true },
    });
    if (!cred) {
      return NextResponse.json({ error: "등록된 안면을 찾을 수 없습니다." }, { status: 404 });
    }
    await prisma.employeeFaceCredential.delete({ where: { id: cred.id } });
  }
  await syncEmployeeFaceFields(session.user.employeeId);

  return NextResponse.json({ ok: true });
}

/** 본인 확인 (descriptor 검증, 저장하지 않음) */
export async function PUT(req: Request) {
  const session = await auth();
  const seatDenied = await seatLoginForbiddenResponse(session);
  if (seatDenied) return seatDenied;
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const disabled = await assertFaceRecognitionEnabled(session.user.companyId);
  if (disabled) return disabled;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verifySchema = z.object({
    descriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH).optional(),
    previewUrl: z.string().max(1_000_000).optional(),
  });
  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "안면 인식에 실패했습니다." }, { status: 400 });
  }

  const probe = parsed.data.descriptor ? parseFaceDescriptor(parsed.data.descriptor) : null;
  const previewUrl =
    parsed.data.previewUrl != null && isValidFacePreviewUrl(parsed.data.previewUrl)
      ? parsed.data.previewUrl
      : null;
  if (!probe && !previewUrl) {
    return NextResponse.json({ error: "안면 인식에 실패했습니다." }, { status: 400 });
  }

  const emp = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
    select: { faceEnrolledAt: true },
  });
  if (!emp?.faceEnrolledAt) {
    return NextResponse.json({ error: "먼저 안면을 등록해 주세요." }, { status: 400 });
  }

  const credentials = await loadEmployeeFaceCredentials(session.user.employeeId);
  if (credentials.length === 0) {
    return NextResponse.json({ error: "등록된 안면 정보가 없습니다. 다시 등록해 주세요." }, { status: 400 });
  }

  const result = await matchFaceHybrid({
    credentials,
    probe128: probe,
    faceImageDataUrl: previewUrl,
  });

  if (!result.matched) {
    return NextResponse.json(
      {
        error: "등록된 얼굴과 일치하지 않습니다. 본인만 출근할 수 있습니다.",
        matched: false,
        confidencePercent: result.confidencePercent,
        distance: result.distance,
        matchPath: result.path,
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    confidencePercent: result.confidencePercent,
    distance: result.distance,
    matchPath: result.path,
  });
}
