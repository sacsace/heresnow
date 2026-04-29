import { auth } from "@/auth";
import { computeLateEarly } from "@/lib/attendanceRules";
import { distanceMeters } from "@/lib/haversine";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, AttendanceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  type: z.nativeEnum(AttendanceType),
  siteId: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional(),
  memo: z.string().max(2000).optional(),
  photoUrl: z.string().max(2000).optional().nullable(),
  deviceInfo: z.string().max(500).optional(),
});

/**
 * 출근/퇴근: 버튼 클릭 시점 좌표만 저장.
 * 반경 내 APPROVED, 반경 외 PENDING + AttendanceException 생성.
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

  const { type, siteId, latitude, longitude, accuracy, memo, photoUrl, deviceInfo } = parsed.data;

  const site = await prisma.site.findFirst({
    where: { id: siteId, companyId: session.user.companyId },
    include: { company: { select: { timezone: true } } },
  });

  if (!site) {
    return NextResponse.json({ error: "근무지를 찾을 수 없습니다." }, { status: 404 });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
  });
  if (!employee) {
    return NextResponse.json({ error: "직원 정보가 올바르지 않습니다." }, { status: 403 });
  }

  const dist = distanceMeters(latitude, longitude, site.latitude, site.longitude);
  const within = dist <= site.allowedRadius;
  const status: AttendanceStatus = within ? "APPROVED" : "PENDING";

  const now = new Date();
  const { isLate, isEarlyLeave } = computeLateEarly(
    now,
    site.company.timezone,
    type === "CHECK_IN" ? "CHECK_IN" : "CHECK_OUT",
    site.expectedCheckIn,
    site.expectedCheckOut
  );

  const ua = req.headers.get("user-agent") ?? "";
  const mergedDevice = deviceInfo?.trim() || ua.slice(0, 500);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.attendanceRecord.create({
      data: {
        companyId: session.user.companyId!,
        employeeId: employee.id,
        siteId: site.id,
        type,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        distanceFromSite: dist,
        status,
        memo: memo?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
        deviceInfo: mergedDevice || null,
        isLate,
        isEarlyLeave,
      },
      include: { site: { select: { name: true } } },
    });

    let exceptionId: string | null = null;
    if (!within) {
      const ex = await tx.attendanceException.create({
        data: {
          companyId: session.user.companyId!,
          attendanceId: record.id,
          reason: memo?.trim() || "반경 외 위치",
          status: "PENDING",
        },
      });
      exceptionId = ex.id;
    }

    return { record, exceptionId };
  });

  return NextResponse.json({
    id: result.record.id,
    status: result.record.status,
    distanceFromSite: result.record.distanceFromSite,
    allowedRadius: site.allowedRadius,
    siteName: result.record.site.name,
    type: result.record.type,
    isLate: result.record.isLate,
    isEarlyLeave: result.record.isEarlyLeave,
    exceptionId: result.exceptionId,
    message:
      status === "APPROVED"
        ? "정상 처리되었습니다."
        : "반경 밖입니다. 예외 승인이 필요합니다.",
  });
}
