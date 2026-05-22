import { auth } from "@/auth";
import { FACE_DESCRIPTOR_LENGTH, isFaceMatch, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const enrollSchema = z.object({
  descriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emp = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
    select: {
      faceEnrolledAt: true,
      company: { select: { faceRecognitionEnabled: true } },
    },
  });
  if (!emp) {
    return NextResponse.json({ error: "직원 정보가 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    enrolled: emp.faceEnrolledAt != null,
    enrolledAt: emp.faceEnrolledAt?.toISOString() ?? null,
    faceRecognitionEnabled: emp.company.faceRecognitionEnabled,
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

  await prisma.employee.update({
    where: { id: session.user.employeeId },
    data: {
      faceDescriptor: descriptor,
      faceEnrolledAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, enrolled: true });
}

/** 출근 시 본인 확인 (descriptor만 검증, 저장하지 않음) */
export async function PUT(req: Request) {
  const session = await auth();
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
    select: { faceDescriptor: true, faceEnrolledAt: true },
  });
  if (!emp?.faceEnrolledAt) {
    return NextResponse.json({ error: "먼저 안면을 등록해 주세요." }, { status: 400 });
  }

  const stored = parseFaceDescriptor(emp.faceDescriptor);
  if (!stored) {
    return NextResponse.json({ error: "등록된 안면 정보가 없습니다. 다시 등록해 주세요." }, { status: 400 });
  }

  if (!isFaceMatch(stored, probe)) {
    return NextResponse.json(
      { error: "등록된 얼굴과 일치하지 않습니다. 본인만 출근할 수 있습니다.", matched: false },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, matched: true });
}
