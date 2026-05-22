import { auth } from "@/auth";
import {
  FACE_DESCRIPTOR_LENGTH,
  isFaceMatch,
  parseFaceDescriptor,
} from "@/lib/faceMatch";
import { evaluateAttendanceWorkFlags } from "@/lib/companyWorkSchedule";
import {
  enqueueMvsAttendanceIfEnabled,
  faceVerifiedForAttendance,
} from "@/lib/integrations/enqueueMvsAttendance";
import { prisma } from "@/lib/prisma";
import { AttendanceType } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { NextResponse } from "next/server";
import { z } from "zod";

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

function calendarDayInTz(isoDate: Date, timeZone: string): string {
  const tz = timeZone.trim() || "UTC";
  try {
    return formatInTimeZone(isoDate, tz, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(isoDate, "UTC", "yyyy-MM-dd");
  }
}

const bodySchema = z
  .object({
    type: z.nativeEnum(AttendanceType),
    latitude: z.number().finite(),
    longitude: z.number().finite(),
    accuracy: z.number().finite().optional(),
    memo: z.string().max(2000).optional(),
    isBusinessTrip: z.boolean().optional().default(false),
    businessTripLocation: z.string().trim().min(1).max(200).optional(),
    businessTripReason: z.string().trim().min(1).max(2000).optional(),
    photoUrl: z.string().max(2_000_000).optional().nullable(),
    deviceInfo: z.string().max(500).optional(),
    /** 출근 시 필수: 등록 얼굴과 일치 검증 */
    faceDescriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "CHECK_IN" && data.isBusinessTrip) {
      if (!data.businessTripLocation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "출장 지역 명칭을 입력해 주세요.",
          path: ["businessTripLocation"],
        });
      }
      if (!data.businessTripReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "출장 사유를 입력해 주세요.",
          path: ["businessTripReason"],
        });
      }
    }
    if (data.type === "CHECK_IN" && !data.isBusinessTrip) {
      if (data.businessTripLocation || data.businessTripReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "일반 출근에는 출장 정보를 보낼 수 없습니다. 출장 모드를 선택해 주세요.",
          path: ["isBusinessTrip"],
        });
      }
    }
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

  const {
    type,
    latitude,
    longitude,
    accuracy,
    memo,
    isBusinessTrip,
    businessTripLocation,
    businessTripReason,
    photoUrl,
    deviceInfo,
    faceDescriptor,
  } = parsed.data;

  const employee = await prisma.employee.findFirst({
    where: { id: session.user.employeeId, companyId: session.user.companyId },
    select: {
      id: true,
      faceDescriptor: true,
      faceEnrolledAt: true,
    },
  });
  if (!employee) {
    return NextResponse.json({ error: "직원 정보가 올바르지 않습니다." }, { status: 403 });
  }

  const [company, lastRecord] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        timezone: true,
        faceRecognitionEnabled: true,
        workStartTime: true,
        workEndTime: true,
        workDays: true,
      },
    }),
    prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, companyId: session.user.companyId },
      orderBy: { timestamp: "desc" },
      select: { type: true, timestamp: true },
    }),
  ]);

  if (!company) {
    return NextResponse.json({ error: "회사 정보를 찾을 수 없습니다." }, { status: 400 });
  }

  const tz = company.timezone?.trim() || "Asia/Seoul";
  const now = new Date();

  const faceRequired = company.faceRecognitionEnabled;
  let faceMatched = false;

  if (type === "CHECK_IN") {
    if (faceRequired) {
      if (!employee.faceEnrolledAt) {
        return NextResponse.json(
          { error: "출근 전 안면 등록이 필요합니다." },
          { status: 400 }
        );
      }
      const probe = parseFaceDescriptor(faceDescriptor);
      const stored = parseFaceDescriptor(employee.faceDescriptor);
      if (!probe || !stored) {
        return NextResponse.json(
          { error: "안면 인식 정보가 없습니다. 다시 인식해 주세요." },
          { status: 400 }
        );
      }
      if (!isFaceMatch(stored, probe)) {
        return NextResponse.json(
          {
            error: "등록된 얼굴과 일치하지 않습니다. 본인만 출근할 수 있습니다.",
          },
          { status: 403 }
        );
      }
      faceMatched = true;
    }

    if (lastRecord?.type === "CHECK_IN") {
      return NextResponse.json(
        { error: "이미 출근한 상태입니다. 먼저 퇴근한 뒤 다음 날에 다시 출근해 주세요." },
        { status: 400 }
      );
    }
    if (lastRecord?.type === "CHECK_OUT") {
      const dayNow = calendarDayInTz(now, tz);
      const dayLastOut = calendarDayInTz(lastRecord.timestamp, tz);
      if (dayNow <= dayLastOut) {
        return NextResponse.json(
          {
            error:
              "퇴근한 당일에는 다시 출근할 수 없습니다. 회사 기준 날짜가 바뀐 뒤(다음날 0시 이후) 출근해 주세요.",
          },
          { status: 400 }
        );
      }
    }
  } else {
    if (!lastRecord || lastRecord.type === "CHECK_OUT") {
      return NextResponse.json({ error: "먼저 출근해 주세요." }, { status: 400 });
    }
    const elapsed = now.getTime() - lastRecord.timestamp.getTime();
    if (elapsed > TWENTY_FOUR_H_MS) {
      return NextResponse.json(
        { error: "출근 시점부터 24시간이 지나 퇴근할 수 없습니다. 관리자에게 문의해 주세요." },
        { status: 400 }
      );
    }
  }

  const ua = req.headers.get("user-agent") ?? "";
  const mergedDevice = deviceInfo?.trim() || ua.slice(0, 500);

  const workFlags = evaluateAttendanceWorkFlags(now, tz, type, {
    workStartTime: company.workStartTime,
    workEndTime: company.workEndTime,
    workDays: company.workDays,
  });

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
        isBusinessTrip: type === "CHECK_IN" ? isBusinessTrip : false,
        businessTripLocation:
          type === "CHECK_IN" && isBusinessTrip ? businessTripLocation!.trim() : null,
        businessTripReason:
          type === "CHECK_IN" && isBusinessTrip ? businessTripReason!.trim() : null,
        photoUrl: photoUrl?.trim() || null,
        deviceInfo: mergedDevice || null,
        isLate: workFlags.isLate,
        isEarlyLeave: workFlags.isEarlyLeave,
        isOvertime: workFlags.isOvertime,
        isHolidayWork: workFlags.isHolidayWork,
        overtimeMinutes: workFlags.overtimeMinutes,
      },
      include: { site: { select: { name: true } } },
    });
    return { record };
  });

  void enqueueMvsAttendanceIfEnabled(
    result.record.id,
    faceVerifiedForAttendance(type, faceRequired, faceMatched)
  );

  return NextResponse.json({
    id: result.record.id,
    status: result.record.status,
    distanceFromSite: result.record.distanceFromSite,
    siteName: result.record.site?.name ?? null,
    isBusinessTrip: result.record.isBusinessTrip,
    businessTripLocation: result.record.businessTripLocation,
    type: result.record.type,
    isLate: result.record.isLate,
    isEarlyLeave: result.record.isEarlyLeave,
    isOvertime: result.record.isOvertime,
    isHolidayWork: result.record.isHolidayWork,
    overtimeMinutes: result.record.overtimeMinutes,
    exceptionId: null,
    message: "정상 처리되었습니다.",
  });
}
