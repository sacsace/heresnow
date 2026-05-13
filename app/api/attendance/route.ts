import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  type: z.nativeEnum(AttendanceType),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional(),
  memo: z.string().max(2000).optional(),
  photoUrl: z.string().max(2000).optional().nullable(),
  deviceInfo: z.string().max(500).optional(),
});

/**
 * 출근/퇴근: 버튼 클릭 시점 좌표만 저장 (근무지 등록 불필요).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.employeeId) {
    return NextResponse.json({ error: "직원 프로필이 필요합니다." }, { status: 403 });
  }

  if (!session.user.companyId) {
    return NextResponse.json({ error: "회사 정보가 없습니다." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, latitude, longitude, accuracy, memo, photoUrl, deviceInfo } = parsed.data;

  const employee = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
  });
  if (!employee) {
    return NextResponse.json({ error: "직원 정보가 올바르지 않습니다." }, { status: 403 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const mergedDevice = deviceInfo?.trim() || ua.slice(0, 500);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.attendanceRecord.create({
      data: {
        company: { connect: { id: session.user.companyId! } },
        employee: { connect: { id: employee.id } },
        type,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        distanceFromSite: 0,
        status: "APPROVED",
        memo: memo?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        deviceInfo: mergedDevice || null,
        isLate: false,
        isEarlyLeave: false,
      },
      include: { site: { select: { name: true } } },
    });
    return { record };
  });

  return NextResponse.json({
    id: result.record.id,
    status: result.record.status,
    distanceFromSite: result.record.distanceFromSite,
    siteName: result.record.site?.name ?? null,
    type: result.record.type,
    isLate: result.record.isLate,
    isEarlyLeave: result.record.isEarlyLeave,
    exceptionId: null,
    message: "정상 처리되었습니다.",
  });
}
