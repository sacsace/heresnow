export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { seatLoginForbiddenResponse } from "@/lib/requireSeatLogin";
import { findConflictingFaceEmployee } from "@/lib/faceEnrollGuard";
import {
  loadEmployeeFaceCredentials,
  matchFaceCredentials,
  syncEmployeeFaceFields,
} from "@/lib/faceCredentials";
import { isValidFacePreviewUrl } from "@/lib/facePreviewValidation";
import { FACE_DESCRIPTOR_LENGTH, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const enrollSchema = z.object({
  descriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH),
  previewUrl: z.string().max(1_000_000).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

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
      company: { select: { faceRecognitionEnabled: true } },
      faceCredentials: {
        select: {
          id: true,
          previewUrl: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!emp) {
    return NextResponse.json({ error: "직원 정보가 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    enrolled: emp.faceEnrolledAt != null,
    enrolledAt: emp.faceEnrolledAt?.toISOString() ?? null,
    hasPreview: emp.faceCredentials.some((c) => c.previewUrl != null),
    faceRecognitionEnabled: emp.company.faceRecognitionEnabled,
    credentials: emp.faceCredentials.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      hasPreview: c.previewUrl != null,
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

export async function POST(req: Request) {
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

  const parsed = enrollSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "유효한 안면 데이터가 필요합니다." }, { status: 400 });
  }

  const descriptor = parseFaceDescriptor(parsed.data.descriptor);
  if (!descriptor) {
    return NextResponse.json({ error: "유효한 안면 데이터가 필요합니다." }, { status: 400 });
  }

  const previewUrl = parsed.data.previewUrl;
  if (previewUrl != null && !isValidFacePreviewUrl(previewUrl)) {
    return NextResponse.json({ error: "유효한 얼굴 미리보기가 필요합니다." }, { status: 400 });
  }

  const conflict = await findConflictingFaceEmployee(
    session.user.companyId,
    session.user.employeeId,
    descriptor
  );
  if (conflict) {
    return NextResponse.json(
      { error: "다른 직원에게 이미 등록된 얼굴과 유사합니다. 본인 얼굴로 다시 등록해 주세요." },
      { status: 409 }
    );
  }

  const created = await prisma.employeeFaceCredential.create({
    data: {
      employeeId: session.user.employeeId,
      descriptor,
      ...(previewUrl != null ? { previewUrl } : {}),
    },
    select: { id: true, createdAt: true },
  });

  await syncEmployeeFaceFields(session.user.employeeId);

  return NextResponse.json({
    ok: true,
    enrolled: true,
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

  const cred = await prisma.employeeFaceCredential.findFirst({
    where: { id: parsed.data.id, employeeId: session.user.employeeId },
    select: { id: true },
  });
  if (!cred) {
    return NextResponse.json({ error: "등록된 안면을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.employeeFaceCredential.delete({ where: { id: cred.id } });
  await syncEmployeeFaceFields(session.user.employeeId);

  return NextResponse.json({ ok: true });
}

/** 본인 확인 (descriptor 검증, 저장하지 않음) — 인식률 % 포함 */
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

  const parsed = enrollSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "안면 인식에 실패했습니다." }, { status: 400 });
  }

  const probe = parseFaceDescriptor(parsed.data.descriptor);
  if (!probe) {
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

  const result = matchFaceCredentials(credentials, probe);

  if (!result.matched) {
    return NextResponse.json(
      {
        error: "등록된 얼굴과 일치하지 않습니다. 본인만 출근할 수 있습니다.",
        matched: false,
        confidencePercent: result.confidencePercent,
        distance: result.distance,
      },
      { status: 403 }
    );
  }

  if (result.credentialId) {
    void prisma.employeeFaceCredential
      .update({
        where: { id: result.credentialId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    confidencePercent: result.confidencePercent,
    distance: result.distance,
    matchedCredentialId: result.credentialId,
  });
}
