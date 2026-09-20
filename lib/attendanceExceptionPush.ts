import { pickMessages, translate, type Locale } from "@/lib/i18n/dictionaries";
import { sendPushToUser } from "@/lib/pushNotify";
import { isWebPushConfigured, type PushPayload } from "@/lib/webPush";

function exceptionKindKey(isEarlyLeave: boolean, isOvertime: boolean): string {
  if (isEarlyLeave) return "approvals.pushExceptionKindEarlyLeave";
  if (isOvertime) return "approvals.pushExceptionKindOvertime";
  return "approvals.pushExceptionKindAttendance";
}

function exceptionResultPushCopy(
  locale: Locale,
  params: {
    approved: boolean;
    isEarlyLeave: boolean;
    isOvertime: boolean;
  }
): PushPayload {
  const messages = pickMessages(locale);
  const t = (key: string) => translate(messages, key);
  const kind = t(exceptionKindKey(params.isEarlyLeave, params.isOvertime));

  if (params.approved) {
    return {
      title: t("approvals.pushExceptionApprovedTitle"),
      body: t("approvals.pushExceptionApprovedBody").replace("{kind}", kind),
      url: "/employee",
      tag: "attendance-exception-approved",
    };
  }

  return {
    title: t("approvals.pushExceptionRejectedTitle"),
    body: t("approvals.pushExceptionRejectedBody").replace("{kind}", kind),
    url: "/employee",
    tag: "attendance-exception-rejected",
  };
}

/** 조퇴·초과근무 등 출퇴근 예외 승인/반려 — 신청 직원에게 푸시 */
export async function notifyEmployeeOfAttendanceExceptionResult(params: {
  employeeUserId: string;
  exceptionId: string;
  approved: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
}): Promise<void> {
  if (!isWebPushConfigured()) return;

  const tag = `attendance-exception-${params.exceptionId}`;
  await sendPushToUser(params.employeeUserId, (locale) => ({
    ...exceptionResultPushCopy(locale, params),
    tag,
  }));
}
