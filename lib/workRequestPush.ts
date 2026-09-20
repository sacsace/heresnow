import { formatWorkRequestDateRange } from "@/lib/workRequestDates";
import { pickMessages, translate, type Locale } from "@/lib/i18n/dictionaries";
import { sendPushToUser } from "@/lib/pushNotify";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured, type PushPayload } from "@/lib/webPush";
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

function workRequestResultPushCopy(
  locale: Locale,
  params: {
    approved: boolean;
    type: WorkRequestType;
    workDate: string;
    workEndDate?: string | null;
  }
): PushPayload {
  const messages = pickMessages(locale);
  const t = (key: string) => translate(messages, key);
  const typeLabel = t(TYPE_I18N_KEY[params.type]);
  const dateLabel = formatWorkRequestDateRange(params.workDate, params.workEndDate);

  if (params.approved) {
    return {
      title: t("approvals.pushWorkRequestApprovedTitle"),
      body: t("approvals.pushWorkRequestApprovedBody")
        .replace("{type}", typeLabel)
        .replace("{date}", dateLabel),
      url: "/employee/approvals",
      tag: "work-request-approved",
    };
  }

  return {
    title: t("approvals.pushWorkRequestRejectedTitle"),
    body: t("approvals.pushWorkRequestRejectedBody")
      .replace("{type}", typeLabel)
      .replace("{date}", dateLabel),
    url: "/employee/approvals",
    tag: "work-request-rejected",
  };
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

/** 근태 신청 승인/반려 — 신청 직원에게 모바일 푸시 */
export async function notifyEmployeeOfWorkRequestResult(params: {
  employeeUserId: string;
  requestId: string;
  approved: boolean;
  type: WorkRequestType;
  workDate: string;
  workEndDate?: string | null;
}): Promise<void> {
  if (!isWebPushConfigured()) return;

  const tag = `work-request-result-${params.requestId}`;
  await sendPushToUser(params.employeeUserId, (locale) => ({
    ...workRequestResultPushCopy(locale, params),
    tag,
  }));
}
