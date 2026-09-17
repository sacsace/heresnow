import { formatWorkRequestDateRange } from "@/lib/workRequestDates";
import { pickMessages, translate, type Locale } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured, sendWebPush, type PushPayload } from "@/lib/webPush";
import type { Role, WorkRequestType } from "@prisma/client";

const TYPE_I18N_KEY: Record<WorkRequestType, string> = {
  OVERTIME: "approvals.workRequestTypeOvertime",
  EARLY_LEAVE: "approvals.workRequestTypeEarlyLeave",
  REMOTE_WORK: "approvals.workRequestTypeRemoteWork",
  VACATION: "approvals.workRequestTypeVacation",
  HALF_DAY_LEAVE: "approvals.workRequestTypeHalfDayLeave",
};

function approvalsUrlForRole(role: Role): string {
  if (
    role === "COMPANY_ADMIN" ||
    role === "HR_MANAGER" ||
    role === "APPROVER" ||
    role === "SUPER_ADMIN"
  ) {
    return "/admin/approvals";
  }
  return "/employee/approvals";
}

function workRequestReceivedPushCopy(
  locale: Locale,
  params: { employeeName: string; type: WorkRequestType; workDate: string; workEndDate?: string | null }
): PushPayload {
  const messages = pickMessages(locale);
  const t = (key: string) => translate(messages, key);
  const typeLabel = t(TYPE_I18N_KEY[params.type]);
  const dateLabel = formatWorkRequestDateRange(params.workDate, params.workEndDate);
  return {
    title: t("approvals.pushReceivedTitle"),
    body: t("approvals.pushReceivedBody")
      .replace("{name}", params.employeeName)
      .replace("{type}", typeLabel)
      .replace("{date}", dateLabel),
    url: "/employee/approvals",
    tag: "work-request-received",
  };
}

async function sendPushToUser(userId: string, buildPayload: (locale: Locale) => PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true },
  });
  if (subscriptions.length === 0) return;

  const removedIds: string[] = [];
  for (const sub of subscriptions) {
    const locale: Locale = sub.locale === "en" ? "en" : "ko";
    const payload = buildPayload(locale);
    const result = await sendWebPush(sub, payload);
    if (!result.ok && result.gone) removedIds.push(sub.id);
  }

  if (removedIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: removedIds } } });
  }
}

/** 근태 신청 접수 — 지정 승인권자에게 모바일 푸시 */
export async function notifyApproverOfWorkRequest(params: {
  approverUserId: string;
  requestId: string;
  employeeName: string;
  type: WorkRequestType;
  workDate: string;
  workEndDate?: string | null;
}): Promise<void> {
  if (!isWebPushConfigured()) return;

  const approver = await prisma.user.findUnique({
    where: { id: params.approverUserId },
    select: { role: true },
  });
  if (!approver) return;

  const url = approvalsUrlForRole(approver.role);
  const tag = `work-request-${params.requestId}`;

  await sendPushToUser(params.approverUserId, (locale) => ({
    ...workRequestReceivedPushCopy(locale, params),
    url,
    tag,
  }));
}
