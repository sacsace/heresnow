import { buildMvsAttendancePayload } from "@/lib/integrations/buildMvsAttendancePayload";
import { dispatchPendingMvsOutbox } from "@/lib/integrations/dispatchMvs";
import { prisma } from "@/lib/prisma";
import { AttendanceType, IntegrationProvider } from "@prisma/client";

const EVENT_TYPE = "attendance.created";

/**
 * 출퇴근 저장 후 MVS 연동 아웃박스에 적재.
 * 연동이 꺼져 있어도 큐에는 쌓지 않음 (enabled + 설정 존재 시만).
 */
export async function enqueueMvsAttendanceIfEnabled(
  attendanceId: string,
  faceVerified: boolean
): Promise<void> {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
    include: {
      company: { select: { timezone: true } },
      employee: { include: { user: { select: { email: true } } } },
    },
  });
  if (!record) return;

  const integration = await prisma.companyIntegration.findUnique({
    where: {
      companyId_provider: {
        companyId: record.companyId,
        provider: IntegrationProvider.MVS,
      },
    },
  });

  if (!integration?.enabled) return;

  const payload = buildMvsAttendancePayload(
    record,
    integration.externalCompanyId,
    faceVerified
  );

  await prisma.integrationOutbox.upsert({
    where: {
      provider_resourceId_eventType: {
        provider: IntegrationProvider.MVS,
        resourceId: record.id,
        eventType: EVENT_TYPE,
      },
    },
    create: {
      companyId: record.companyId,
      provider: IntegrationProvider.MVS,
      eventType: EVENT_TYPE,
      resourceId: record.id,
      payload,
      status: "PENDING",
    },
    update: {
      payload,
      status: "PENDING",
      attempts: 0,
      lastError: null,
      deliveredAt: null,
    },
  });

  const webhookUrl =
    integration.webhookUrl?.trim() || process.env.MVS_DEFAULT_WEBHOOK_URL?.trim() || null;
  if (webhookUrl) {
    void dispatchPendingMvsOutbox({ companyId: record.companyId, limit: 5 }).catch(() => {
      /* 배치·크론으로 재시도 */
    });
  }
}

export function faceVerifiedForAttendance(
  type: AttendanceType,
  faceRequired: boolean,
  faceMatched: boolean
): boolean {
  return type === AttendanceType.CHECK_IN && faceRequired && faceMatched;
}
